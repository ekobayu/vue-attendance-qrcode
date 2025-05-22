import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Admin from '../views/Admin.vue'
import User from '../views/User.vue'
import AdminSetup from '../views/AdminSetup.vue'
import RemoteAttendance from '../views/RemoteAttendance.vue'
import SignUp from '../components/SignUp.vue'
import UserManagement from '../components/UserManagement.vue'
import { auth } from '../firebase/config'

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
    meta: { requiresAuth: true }
  },
  {
    path: '/user',
    name: 'User',
    component: User,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin-setup',
    name: 'AdminSetup',
    component: AdminSetup
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
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
  const currentUser = auth.currentUser

  if (requiresAuth && !currentUser) {
    next('/')
  } else if (requiresAdmin) {
    // Check if user is admin (this is a simplified check)
    // In a real app, you would check the admin status in the database
    if (currentUser) {
      // You would check admin status here
      next()
    } else {
      next('/')
    }
  } else {
    next()
  }
})

export default router
