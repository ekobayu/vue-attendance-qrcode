import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Admin from '../views/Admin.vue'
import User from '../views/User.vue'
import RemoteAttendance from '../views/RemoteAttendance.vue'
import SignUp from '../components/SignUp.vue'
import UserManagement from '../components/UserManagement.vue'
import QRDisplay from '../components/QRDisplay.vue'
import EarlyBirdPage from '../components/EarlyBirdPage.vue'
import { auth, db } from '../firebase/config'
import { ref as dbRef, get } from 'firebase/database'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/admin',
    name: 'Admin',
    component: Admin,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/user',
    name: 'User',
    component: User,
    meta: { requiresAuth: true }
  },
  {
    path: '/remote-attendance',
    name: 'RemoteAttendance',
    component: RemoteAttendance,
    meta: { requiresAuth: true }
  },
  {
    path: '/signup',
    name: 'SignUp',
    component: SignUp
  },
  {
    path: '/users',
    name: 'UserManagement',
    component: UserManagement,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/qr-display',
    name: 'QRDisplay',
    component: QRDisplay,
    meta: {
      hideNavigation: true
    }
  },
  {
    path: '/early-check-in',
    name: 'EarlyBirdPage',
    component: EarlyBirdPage,
    meta: {
      hideNavigation: true
    }
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// Check if user is admin
async function isUserAdmin(userId) {
  try {
    const userRef = dbRef(db, `users/${userId}`)
    const snapshot = await get(userRef)

    if (snapshot.exists()) {
      const userData = snapshot.val()
      return userData && userData.isAdmin === true
    }
    return false
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
  const currentUser = auth.currentUser

  // If route requires auth and no user is logged in
  if (requiresAuth && !currentUser) {
    // Store the intended destination for after login
    sessionStorage.setItem('redirectAfterLogin', to.fullPath)
    next('/')
  }
  // If route requires admin privileges
  else if (requiresAdmin) {
    if (currentUser) {
      // Check if user is admin
      const admin = await isUserAdmin(currentUser.uid)
      if (admin) {
        next()
      } else {
        // If user is not admin, redirect to user page
        next('/user')
      }
    } else {
      // If no user is logged in, redirect to login
      sessionStorage.setItem('redirectAfterLogin', to.fullPath)
      next('/')
    }
  }
  // For all other routes
  else {
    next()
  }
})

export default router
