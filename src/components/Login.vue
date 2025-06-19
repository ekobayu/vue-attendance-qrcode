<template>
  <div class="login-container">
    <h2>Login</h2>

    <form @submit.prevent="login" v-if="!forgotPasswordMode">
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="verificationMessage" class="verification-message">{{ verificationMessage }}</div>

      <div class="form-group">
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="email" required />
      </div>

      <div class="form-group">
        <label for="password">Password:</label>
        <div class="password-input-container">
          <input :type="showPassword ? 'text' : 'password'" id="password" v-model="password" required />
          <button type="button" class="toggle-password" @click="showPassword = !showPassword">
            {{ showPassword ? 'Hide' : 'Show' }}
          </button>
        </div>
      </div>

      <div class="forgot-password">
        <a href="#" @click.prevent="showForgotPassword">Forgot Password?</a>
      </div>

      <button type="submit" :disabled="loading" class="login-button">
        {{ loading ? 'Logging in...' : 'Login' }}
      </button>

      <div class="signup-link">Don't have an account? <router-link to="/signup">Sign Up</router-link></div>
    </form>

    <!-- Forgot Password Form -->
    <div v-if="forgotPasswordMode" class="forgot-password-form">
      <h3>Reset Password</h3>
      <p>Enter your email address and we'll send you a link to reset your password.</p>

      <div v-if="resetMessage" class="reset-message" :class="resetStatus">
        {{ resetMessage }}
      </div>

      <div class="form-group">
        <label for="reset-email">Email:</label>
        <input type="email" id="reset-email" v-model="resetEmail" required />
      </div>

      <div class="form-actions">
        <button @click="sendResetEmail" :disabled="resetLoading" class="reset-button">
          {{ resetLoading ? 'Sending...' : 'Send Reset Link' }}
        </button>
        <button @click="forgotPasswordMode = false" class="cancel-button">Back to Login</button>
      </div>
    </div>
  </div>
</template>

<script>
import { auth, db } from '../firebase/config'
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth'
import { ref as dbRef, get } from 'firebase/database'

export default {
  name: 'LoginPage',
  data() {
    return {
      email: '',
      password: '',
      error: null,
      loading: false,
      showPassword: false,
      forgotPasswordMode: false,
      resetEmail: '',
      resetMessage: '',
      resetStatus: '',
      resetLoading: false,
      verificationMessage: ''
    }
  },
  created() {
    // Check if user is already logged in
    const currentUser = auth.currentUser
    if (currentUser && currentUser.emailVerified) {
      this.redirectLoggedInUser(currentUser)
    }
  },
  methods: {
    async login() {
      this.loading = true
      this.error = null
      this.verificationMessage = ''

      try {
        const userCredential = await signInWithEmailAndPassword(auth, this.email, this.password)
        const user = userCredential.user

        // Check if email is verified
        if (!user.emailVerified) {
          // Sign out the user
          await auth.signOut()

          // Show verification message
          this.verificationMessage =
            'Please verify your email before logging in. A verification link was sent to your email address.'

          // Resend verification email
          await sendEmailVerification(user)

          this.loading = false
          return
        }

        // Email is verified, proceed with login
        this.$emit('login-success', user)

        // Redirect user based on their role
        await this.redirectLoggedInUser(user)
      } catch (error) {
        console.error('Login error:', error)

        switch (error.code) {
          case 'auth/user-not-found':
            this.error = 'No account found with this email address.'
            break
          case 'auth/wrong-password':
            this.error = 'Incorrect password. Please try again.'
            break
          case 'auth/too-many-requests':
            this.error = 'Too many failed login attempts. Please try again later.'
            break
          default:
            this.error = 'Failed to log in. Please check your credentials and try again.'
        }
      } finally {
        this.loading = false
      }
    },

    async redirectLoggedInUser(user) {
      try {
        // Check if there's a redirect path stored in session storage
        const redirectPath = sessionStorage.getItem('redirectAfterLogin')

        if (redirectPath) {
          // Clear the stored path
          sessionStorage.removeItem('redirectAfterLogin')
          // Redirect to the stored path
          this.$router.push(redirectPath)
          return
        }

        // If no redirect path, check if user is admin
        const userRef = dbRef(db, `users/${user.uid}`)
        const snapshot = await get(userRef)

        if (snapshot.exists()) {
          const userData = snapshot.val()
          const isAdmin = userData && userData.isAdmin === true

          // Redirect based on role
          if (isAdmin) {
            this.$router.push('/admin')
          } else {
            this.$router.push('/user')
          }
        } else {
          // Default redirect if no user data
          this.$router.push('/user')
        }
      } catch (error) {
        console.error('Error during redirect:', error)
        // Default redirect on error
        this.$router.push('/user')
      }
    },

    showForgotPassword() {
      this.forgotPasswordMode = true
      this.resetEmail = this.email // Pre-fill with the email from login form
    },

    async sendResetEmail() {
      if (!this.resetEmail) {
        this.resetMessage = 'Please enter your email address.'
        this.resetStatus = 'error'
        return
      }

      this.resetLoading = true
      this.resetMessage = ''

      try {
        await sendPasswordResetEmail(auth, this.resetEmail)
        this.resetMessage = 'Password reset link sent! Check your email.'
        this.resetStatus = 'success'
      } catch (error) {
        console.error('Reset password error:', error)

        switch (error.code) {
          case 'auth/user-not-found':
            this.resetMessage = 'No account found with this email address.'
            break
          case 'auth/invalid-email':
            this.resetMessage = 'Please enter a valid email address.'
            break
          default:
            this.resetMessage = 'Failed to send reset link. Please try again.'
        }
        this.resetStatus = 'error'
      } finally {
        this.resetLoading = false
      }
    }
  }
}
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 30px;
  background-color: #fff;
  border-radius: 8px;
  color: #2c3e50;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

input[type='email'],
input[type='password'],
input[type='text'] {
  width: 93%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  background-color: #fff;
  color: #2c3e50;
}

input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.password-input-container {
  position: relative;
}

.toggle-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
}

.forgot-password {
  text-align: right;
  margin-bottom: 20px;
}

.forgot-password a {
  color: #2196f3;
  text-decoration: none;
  font-size: 14px;
}

.forgot-password a:hover {
  text-decoration: underline;
}

.login-button {
  width: 100%;
  padding: 12px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.login-button:hover {
  background-color: #45a049;
}

.login-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error {
  background-color: #f2dede;
  color: #a94442;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.verification-message {
  background-color: #fcf8e3;
  color: #8a6d3b;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.signup-link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #666;
}

.signup-link a {
  color: #2196f3;
  text-decoration: none;
}

.signup-link a:hover {
  text-decoration: underline;
}

/* Forgot Password Form Styles */
.forgot-password-form {
  text-align: center;
}

.forgot-password-form h3 {
  margin-bottom: 10px;
}

.forgot-password-form p {
  color: #666;
  margin-bottom: 20px;
}

.reset-message {
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.reset-message.success {
  background-color: #dff0d8;
  color: #3c763d;
}

.reset-message.error {
  background-color: #f2dede;
  color: #a94442;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.reset-button {
  flex: 1;
  padding: 10px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.reset-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.cancel-button {
  flex: 1;
  padding: 10px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
