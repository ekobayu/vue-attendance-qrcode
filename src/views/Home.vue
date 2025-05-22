<template>
  <div class="home">
    <h1>Attendance System</h1>

    <div v-if="user">
      <p>Welcome, {{ user.email }}</p>
      <div class="actions">
        <router-link to="/user" class="btn">Mark Attendance</router-link>
        <router-link v-if="isAdmin" to="/admin" class="btn admin">Admin Panel</router-link>
      </div>
    </div>

    <div v-else>
      <Login @login-success="handleLoginSuccess" />
    </div>
  </div>
</template>

<script>
import { auth, db } from '../firebase/config'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref as dbRef, get } from 'firebase/database'
import Login from '../components/Login.vue'

export default {
  name: 'HomePage',
  components: {
    Login
  },
  data() {
    return {
      user: null,
      isAdmin: false
    }
  },
  created() {
    onAuthStateChanged(auth, (user) => {
      this.user = user
      if (user) {
        this.checkAdminStatus(user.uid)
      }
    })
  },
  methods: {
    handleLoginSuccess(user) {
      this.user = user
      this.checkAdminStatus(user.uid)
    },

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

    async logout() {
      try {
        await signOut(auth)
        this.user = null
        this.isAdmin = false
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.home h1 {
  text-align: center;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  display: inline-block;
  background-color: #4caf50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  font-size: 16px;
}

.admin {
  background-color: #2196f3;
}

.logout {
  background-color: #f44336;
}
</style>
