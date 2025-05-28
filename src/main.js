import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { auth } from './firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { setupVerificationStatusUpdater } from './services/auth'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

// Toast configuration options
const toastOptions = {
  position: 'top-right',
  timeout: 3000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false
}

// Navigation guard
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  // Call this during app initialization
  setupVerificationStatusUpdater()

  if (requiresAuth) {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        next('/')
      } else {
        next()
      }
    })
  } else {
    next()
  }
})

const app = createApp(App)
app.use(router)
app.use(Toast, toastOptions) // Add Toast to your app with options
app.mount('#app')
