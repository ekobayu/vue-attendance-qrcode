<template>
  <div id="app">
    <div v-if="authInitialized">
      <header v-if="!$route.meta.hideNavigation">
        <nav v-if="user">
          <div class="nav-links">
            <router-link to="/">Home</router-link> | <router-link to="/user">Mark Attendance</router-link>
            <span v-if="isAdmin">|</span>
            <router-link v-if="isAdmin" to="/admin">Admin Panel</router-link>
          </div>
          <div class="nav-controls">
            <button
              @click="toggleTheme"
              class="theme-toggle-btn"
              :title="isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
            >
              <span v-if="isDarkTheme">🌞</span>
              <span v-else>🌙</span>
            </button>
            <button @click="logout" class="logout-btn">Logout</button>
          </div>
        </nav>
      </header>
      <router-view @login-success="handleLoginSuccess" />
      <footer v-if="!$route.meta.hideNavigation">
        <!-- Footer content -->
      </footer>
    </div>
    <div v-else class="loading-auth">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
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
      isAdmin: false,
      authInitialized: false,
      isDarkTheme: false
    }
  },
  created() {
    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Only set user if email is verified
        if (user.emailVerified) {
          this.user = user
          await this.checkAdminStatus(user.uid)
        } else {
          // If email is not verified, sign out
          // this.logout()
        }
      } else {
        this.user = null
        this.isAdmin = false
      }

      // Mark authentication as initialized
      this.authInitialized = true
    })

    // Load theme preference from localStorage
    this.loadThemePreference()
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
    },

    toggleTheme() {
      this.isDarkTheme = !this.isDarkTheme
      localStorage.setItem('darkTheme', this.isDarkTheme)

      // Apply or remove dark-theme class to body element
      if (this.isDarkTheme) {
        document.body.classList.add('dark-theme')
      } else {
        document.body.classList.remove('dark-theme')
      }

      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', this.isDarkTheme ? '#121212' : '#ffffff')
      }
    },

    loadThemePreference() {
      const savedTheme = localStorage.getItem('darkTheme')
      if (savedTheme !== null) {
        this.isDarkTheme = savedTheme === 'true'
      } else {
        // Check if user prefers dark mode at the OS level
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        this.isDarkTheme = prefersDark
      }

      // Apply dark-theme class to body if needed
      if (this.isDarkTheme) {
        document.body.classList.add('dark-theme')
      } else {
        document.body.classList.remove('dark-theme')
      }

      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', this.isDarkTheme ? '#121212' : '#ffffff')
      }
    }
  }
}
</script>

<style>
:root {
  /* Light theme variables */
  --bg-color: #ffffff;
  --text-color: #2c3e50;
  --nav-active-color: #42b983;
  --card-bg: #f9f9f9;
  --border-color: #e0e0e0;
  --header-bg: #f5f5f5;
  --button-primary-bg: #42b983;
  --button-primary-text: white;
  --button-secondary-bg: #f5f5f5;
  --button-secondary-text: #333;
  --input-bg: white;
  --input-border: #ddd;
  --table-header-bg: #f2f2f2;
  --table-row-hover: #f5f5f5;
  --table-border: #ddd;
  --shadow-color: rgba(0, 0, 0, 0.1);
  --badge-office-bg: #e8f5e9;
  --badge-office-text: #388e3c;
  --badge-remote-bg: #e3f2fd;
  --badge-remote-text: #1976d2;
  --badge-mixed-bg: #e1f5fe;
  --badge-mixed-text: #0277bd;
}

.dark-theme {
  /* Dark theme variables */
  --bg-color: #121212;
  --text-color: #e0e0e0;
  --nav-active-color: #5cdbaa;
  --card-bg: #1e1e1e;
  --border-color: #333333;
  --header-bg: #1a1a1a;
  --button-primary-bg: #388e3c;
  --button-primary-text: white;
  --button-secondary-bg: #333333;
  --button-secondary-text: #e0e0e0;
  --input-bg: #2d2d2d;
  --input-border: #444444;
  --table-header-bg: #2d2d2d;
  --table-row-hover: #eaeaea;
  --table-border: #444444;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --badge-office-bg: #1b5e20;
  --badge-office-text: #a5d6a7;
  --badge-remote-bg: #0d47a1;
  --badge-remote-text: #90caf9;
  --badge-mixed-bg: #01579b;
  --badge-mixed-text: #81d4fa;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s ease, color 0.3s ease;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-color);
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
}

nav {
  padding: 20px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
}

.nav-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

nav a {
  font-weight: bold;
  color: var(--text-color);
  text-decoration: none;
  margin: 0 10px;
  transition: color 0.3s ease;
}

nav a.router-link-exact-active {
  color: var(--nav-active-color);
}

.logout-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.logout-btn:hover {
  background-color: #d32f2f;
}

.theme-toggle-btn {
  background-color: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.theme-toggle-btn:hover {
  background-color: var(--button-secondary-bg);
}

.loading-auth {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: var(--text-color);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top: 4px solid var(--nav-active-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Additional dark theme styles for common elements */
.dark-theme input,
.dark-theme select,
.dark-theme textarea {
  background-color: var(--input-bg);
  color: var(--text-color);
  border: 1px solid var(--input-border);
}

.dark-theme button {
  background-color: var(--button-secondary-bg);
  color: var(--button-secondary-text);
}

.dark-theme button.primary-btn,
.dark-theme .export-btn,
.dark-theme .view-all-btn {
  background-color: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.dark-theme table {
  border-color: var(--table-border);
}

.dark-theme th {
  background-color: var(--table-header-bg);
}

.dark-theme tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.05);
}

.dark-theme tr:hover {
  background-color: var(--table-row-hover);
}

.dark-theme .card,
.dark-theme .modal-content,
.dark-theme .early-bird-section,
.dark-theme .session-item {
  background-color: var(--card-bg);
  border-color: var(--border-color);
}

.dark-theme .remote-badge {
  background-color: var(--badge-remote-bg);
  color: var(--badge-remote-text);
}

.dark-theme .in-person-badge {
  background-color: var(--badge-office-bg);
  color: var(--badge-office-text);
}

.dark-theme .mixed-badge {
  background-color: var(--badge-mixed-bg);
  color: var(--badge-mixed-text);
}

@media (max-width: 768px) {
  nav {
    flex-direction: column;
    gap: 15px;
  }

  .nav-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
