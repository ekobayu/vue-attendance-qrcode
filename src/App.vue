<template>
  <div id="app">
    <header v-if="!$route.meta.hideNavigation">
      <nav v-if="user">
        <router-link to="/">Home</router-link> |
        <router-link to="/user">Mark Attendance</router-link>
        <router-link v-if="isAdmin" to="/admin">| Admin Panel</router-link>
        <button @click="logout" class="logout-btn">Logout</button>
      </nav>
    </header>
    <router-view @login-success="handleLoginSuccess" />
    <footer v-if="!$route.meta.hideNavigation">
      <!-- Footer content -->
    </footer>
  </div>
</template>

<script>
import { auth, db } from './firebase/config'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref as dbRef, get } from 'firebase/database'

export default {
  data() {
    return {
      user: null,
      isAdmin: false
    }
  },
  created() {
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Only set user if email is verified
        if (user.emailVerified) {
          this.user = user
          this.checkAdminStatus(user.uid)
        } else {
          // If email is not verified, sign out
          // this.logout()
        }
      } else {
        this.user = null
        this.isAdmin = false

        // Redirect to login if trying to access protected routes
        const currentRoute = this.$router.currentRoute
        if (currentRoute.meta && currentRoute.meta.requiresAuth) {
          this.$router.push('/')
        }
      }
    })
  },
  methods: {
    async checkAdminStatus(userId) {
      try {
        const userRef = dbRef(db, `users/${userId}`)
        const snapshot = await get(userRef)

        if (snapshot.exists()) {
          const userData = snapshot.val()
          this.isAdmin = userData && userData.isAdmin === true
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
      }
    },

    handleLoginSuccess(user) {
      this.user = user
      this.checkAdminStatus(user.uid)
    },

    async logout() {
      try {
        await signOut(auth)
        this.user = null
        this.isAdmin = false
        this.$router.push('/')
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

nav {
  padding: 20px 0;
  display: flex;
  align-items: center;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
  text-decoration: none;
  margin: 0 10px;
}

nav a.router-link-exact-active {
  color: #42b983;
}

.logout-btn {
  margin-left: auto;
  background-color: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
