<template>
  <div class="admin-setup">
    <h2>Admin Setup</h2>

    <div v-if="!user">
      <p>Please log in first to set up admin access.</p>
      <div class="form-group">
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="email" required />
      </div>

      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" id="password" v-model="password" required />
      </div>

      <button @click="login" :disabled="loading">
        {{ loading ? 'Logging in...' : 'Login' }}
      </button>
    </div>

    <div v-else>
      <p>Logged in as: {{ user.email }}</p>
      <button @click="makeAdmin" :disabled="adminSetupComplete">
        {{ adminSetupComplete ? 'Admin Setup Complete' : 'Make This User Admin' }}
      </button>
      <p v-if="message" class="message" :class="messageType">{{ message }}</p>
    </div>
  </div>
</template>

<script>
import { auth, db } from '../firebase/config'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { ref as dbRef, set, get } from 'firebase/database'

export default {
  name: 'AdminSetup',
  data() {
    return {
      email: '',
      password: '',
      user: null,
      loading: false,
      message: '',
      messageType: '',
      adminSetupComplete: false
    }
  },
  created() {
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
      this.user = user
      if (user) {
        this.checkAdminStatus()
      }
    })
  },
  methods: {
    async login() {
      this.loading = true
      try {
        const userCredential = await signInWithEmailAndPassword(auth, this.email, this.password)
        this.user = userCredential.user
        this.checkAdminStatus()
      } catch (error) {
        this.message = `Login failed: ${error.message}`
        this.messageType = 'error'
      } finally {
        this.loading = false
      }
    },

    async checkAdminStatus() {
      if (!this.user) return

      const userRef = dbRef(db, `users/${this.user.uid}`)
      const snapshot = await get(userRef)

      if (snapshot.exists()) {
        const userData = snapshot.val()
        this.adminSetupComplete = userData && userData.isAdmin === true

        if (this.adminSetupComplete) {
          this.message = 'This user is already an admin.'
          this.messageType = 'success'
        }
      }
    },

    async makeAdmin() {
      if (!this.user) return

      try {
        const userRef = dbRef(db, `users/${this.user.uid}`)
        await set(userRef, {
          email: this.user.email,
          isAdmin: true
        })

        this.adminSetupComplete = true
        this.message = 'Admin setup complete! You now have admin privileges.'
        this.messageType = 'success'
      } catch (error) {
        this.message = `Failed to set admin privileges: ${error.message}`
        this.messageType = 'error'
      }
    }
  }
}
</script>

<style scoped>
.admin-setup {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  background-color: #4caf50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

button:disabled {
  background-color: #cccccc;
}

.message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
}

.success {
  background-color: #dff0d8;
  color: #3c763d;
}

.error {
  background-color: #f2dede;
  color: #a94442;
}
</style>
