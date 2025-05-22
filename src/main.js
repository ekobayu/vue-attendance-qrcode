import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { auth } from './firebase/config'
import { onAuthStateChanged } from 'firebase/auth'

// Navigation guard
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

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
app.mount('#app')
