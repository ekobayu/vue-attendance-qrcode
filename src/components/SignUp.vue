<template>
  <div class="signup-container">
    <h2>Create an Account</h2>

    <form @submit.prevent="registerUser" class="signup-form" v-if="!registrationSuccess">
      <!-- Full Name Field -->
      <div class="form-group">
        <label for="fullName">Full Name</label>
        <input type="text" id="fullName" v-model="fullName" required :class="{ 'error-input': errors.fullName }" />
        <div v-if="errors.fullName" class="error-message">{{ errors.fullName }}</div>
      </div>

      <!-- Email Field -->
      <div class="form-group">
        <label for="email">Email Address</label>
        <input
          type="email"
          id="email"
          v-model="email"
          required
          @blur="validateEmail"
          :class="{ 'error-input': errors.email }"
        />
        <div v-if="errors.email" class="error-message">{{ errors.email }}</div>
      </div>

      <!-- Password Field -->
      <div class="form-group">
        <label for="password">Password</label>
        <div class="password-input-container">
          <input
            :type="showPassword ? 'text' : 'password'"
            id="password"
            v-model="password"
            required
            @input="validatePassword"
            :class="{ 'error-input': errors.password }"
          />
          <button type="button" class="toggle-password" @click="showPassword = !showPassword">
            {{ showPassword ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div v-if="errors.password" class="error-message">{{ errors.password }}</div>

        <!-- Password Strength Indicator -->
        <div class="password-strength" v-if="password">
          <div class="strength-label">Password Strength:</div>
          <div class="strength-meter">
            <div
              class="strength-value"
              :style="{ width: passwordStrength.percent + '%' }"
              :class="passwordStrength.class"
            ></div>
          </div>
          <div class="strength-text" :class="passwordStrength.class">
            {{ passwordStrength.text }}
          </div>
        </div>

        <!-- Password Requirements -->
        <div class="password-requirements">
          <p>Password must contain:</p>
          <ul>
            <li :class="{ 'requirement-met': passwordChecks.length }">At least 8 characters</li>
            <li :class="{ 'requirement-met': passwordChecks.uppercase }">At least one uppercase letter</li>
            <li :class="{ 'requirement-met': passwordChecks.lowercase }">At least one lowercase letter</li>
            <li :class="{ 'requirement-met': passwordChecks.number }">At least one number</li>
            <li :class="{ 'requirement-met': passwordChecks.special }">At least one special character</li>
          </ul>
        </div>
      </div>

      <!-- Confirm Password Field -->
      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          v-model="confirmPassword"
          required
          @input="validateConfirmPassword"
          :class="{ 'error-input': errors.confirmPassword }"
        />
        <div v-if="errors.confirmPassword" class="error-message">{{ errors.confirmPassword }}</div>
      </div>

      <!-- Terms and Conditions -->
      <div class="form-group checkbox-group">
        <input type="checkbox" id="termsAccepted" v-model="termsAccepted" required />
        <label for="termsAccepted">
          I agree to the <a href="#" @click.prevent="showTerms">Terms and Conditions</a>
        </label>
        <div v-if="errors.terms" class="error-message">{{ errors.terms }}</div>
      </div>

      <!-- Submit Button -->
      <div class="form-actions">
        <button type="submit" class="signup-button" :disabled="isSubmitting || !isFormValid">
          {{ isSubmitting ? 'Creating Account...' : 'Create Account' }}
        </button>
      </div>

      <!-- Already have an account link -->
      <div class="login-link">Already have an account? <router-link to="/">Log In</router-link></div>
    </form>

    <!-- Success Message with Email Verification Instructions -->
    <div v-if="registrationSuccess" class="verification-container">
      <div class="success-icon">✓</div>
      <h3>Registration Successful!</h3>

      <div class="verification-card">
        <div class="verification-header">
          <div class="email-icon">✉️</div>
          <h4>Verify Your Email</h4>
        </div>

        <div class="verification-content">
          <p>We've sent a verification link to:</p>
          <div class="email-address">{{ email }}</div>

          <div class="verification-steps">
            <p><strong>Next steps:</strong></p>
            <ol>
              <li>Check your email inbox (and spam folder)</li>
              <li>Click on the verification link in the email</li>
              <li>Once verified, you can log in to your account</li>
            </ol>
          </div>

          <div class="verification-note">
            <p>Didn't receive the email?</p>
            <button @click="resendVerificationEmail" class="resend-button" :disabled="resending">
              {{ resending ? 'Sending...' : 'Resend Verification Email' }}
            </button>
          </div>
        </div>
      </div>

      <!-- <div class="auto-logout-notice" v-if="showLogoutNotice">
        <div class="countdown-container">
          <p>
            For security reasons, you will be logged out in <span class="countdown">{{ logoutCountdown }}</span> seconds
          </p>
        </div>
      </div> -->

      <div class="action-buttons">
        <router-link to="/" class="home-button">Go to Home</router-link>
        <!-- <router-link to="/login" class="login-button">Go to Login</router-link> -->
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="registrationError" class="registration-error">
      {{ registrationError }}
    </div>

    <!-- Terms and Conditions Modal -->
    <div v-if="showTermsModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Terms and Conditions</h3>
          <button @click="showTermsModal = false" class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <h4>1. Acceptance of Terms</h4>
          <p>By accessing and using this attendance system, you agree to be bound by these Terms and Conditions.</p>

          <h4>2. User Registration</h4>
          <p>You agree to provide accurate and complete information when creating an account.</p>

          <h4>3. Privacy Policy</h4>
          <p>
            Your use of this system is also governed by our Privacy Policy, which outlines how we collect and use your
            personal information.
          </p>

          <h4>4. User Responsibilities</h4>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities
            that occur under your account.
          </p>

          <h4>5. Attendance Records</h4>
          <p>You acknowledge that attendance records created through this system may be used for official purposes.</p>
        </div>
        <div class="modal-footer">
          <button @click="acceptTerms" class="accept-button">Accept</button>
          <button @click="showTermsModal = false" class="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { auth, db } from '../firebase/config'
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth'
import { ref as dbRef, set } from 'firebase/database'

export default {
  name: 'SignUp',
  data() {
    return {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
      showPassword: false,
      showTermsModal: false,
      isSubmitting: false,
      registrationSuccess: false,
      registrationError: '',
      logoutCountdown: 5,
      logoutTimer: null,
      showLogoutNotice: false,
      resending: false,
      errors: {
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        terms: ''
      },
      passwordChecks: {
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
      },
      // Store user temporarily for resending verification
      tempUser: null
    }
  },
  computed: {
    isFormValid() {
      return (
        this.fullName.trim() !== '' &&
        this.isEmailValid(this.email) &&
        this.isPasswordValid(this.password) &&
        this.password === this.confirmPassword &&
        this.termsAccepted &&
        !this.errors.fullName &&
        !this.errors.email &&
        !this.errors.password &&
        !this.errors.confirmPassword
      )
    },
    passwordStrength() {
      if (!this.password) {
        return { percent: 0, class: '', text: '' }
      }

      // Count how many checks passed
      const checks = Object.values(this.passwordChecks).filter(Boolean).length

      // Calculate percentage (0-100)
      const percent = (checks / 5) * 100

      // Determine strength class and text
      let strengthClass = ''
      let strengthText = ''

      if (percent <= 20) {
        strengthClass = 'very-weak'
        strengthText = 'Very Weak'
      } else if (percent <= 40) {
        strengthClass = 'weak'
        strengthText = 'Weak'
      } else if (percent <= 60) {
        strengthClass = 'medium'
        strengthText = 'Medium'
      } else if (percent <= 80) {
        strengthClass = 'strong'
        strengthText = 'Strong'
      } else {
        strengthClass = 'very-strong'
        strengthText = 'Very Strong'
      }

      return {
        percent,
        class: strengthClass,
        text: strengthText
      }
    }
  },
  beforeUnmount() {
    if (this.logoutTimer) {
      clearInterval(this.logoutTimer)
    }
  },
  methods: {
    validateFullName() {
      if (this.fullName.trim().length < 2) {
        this.errors.fullName = 'Full name must be at least 2 characters'
      } else {
        this.errors.fullName = ''
      }
    },

    validateEmail() {
      if (!this.isEmailValid(this.email)) {
        this.errors.email = 'Please enter a valid email address'
      } else {
        this.errors.email = ''
      }
    },

    isEmailValid(email) {
      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    },

    validatePassword() {
      // Check password length
      this.passwordChecks.length = this.password.length >= 8

      // Check for uppercase letter
      this.passwordChecks.uppercase = /[A-Z]/.test(this.password)

      // Check for lowercase letter
      this.passwordChecks.lowercase = /[a-z]/.test(this.password)

      // Check for number
      this.passwordChecks.number = /[0-9]/.test(this.password)

      // Check for special character
      this.passwordChecks.special = /[!@#$%^&*(),.?":{}|]/.test(this.password)

      // Set error message if password doesn't meet requirements
      if (!this.isPasswordValid(this.password)) {
        this.errors.password = 'Password does not meet the requirements'
      } else {
        this.errors.password = ''
      }

      // Also validate confirm password if it's not empty
      if (this.confirmPassword) {
        this.validateConfirmPassword()
      }
    },

    isPasswordValid() {
      return (
        this.passwordChecks.length &&
        this.passwordChecks.uppercase &&
        this.passwordChecks.lowercase &&
        this.passwordChecks.number &&
        this.passwordChecks.special
      )
    },

    validateConfirmPassword() {
      if (this.password !== this.confirmPassword) {
        this.errors.confirmPassword = 'Passwords do not match'
      } else {
        this.errors.confirmPassword = ''
      }
    },

    showTerms() {
      this.showTermsModal = true
    },

    acceptTerms() {
      this.termsAccepted = true
      this.showTermsModal = false
      this.errors.terms = ''
    },

    startLogoutCountdown() {
      // Wait for 2 seconds before showing the logout notice
      setTimeout(() => {
        this.showLogoutNotice = true

        this.logoutTimer = setInterval(() => {
          this.logoutCountdown--

          if (this.logoutCountdown <= 0) {
            clearInterval(this.logoutTimer)
            this.performLogout()
          }
        }, 1000)
      }, 2000)
    },

    async performLogout() {
      try {
        await signOut(auth)
        // Don't redirect, just stay on the current page
      } catch (error) {
        console.error('Logout error:', error)
      }
    },

    async resendVerificationEmail() {
      if (!this.tempUser) {
        this.registrationError = 'Unable to resend verification email. Please try registering again.'
        return
      }

      this.resending = true

      try {
        await sendEmailVerification(this.tempUser)

        // Show temporary success message
        const originalError = this.registrationError
        this.registrationError = 'Verification email sent successfully!'

        // Reset error message after 3 seconds
        setTimeout(() => {
          if (this.registrationError === 'Verification email sent successfully!') {
            this.registrationError = originalError
          }
        }, 3000)
      } catch (error) {
        console.error('Error resending verification email:', error)
        this.registrationError = 'Failed to resend verification email. Please try again later.'
      } finally {
        this.resending = false
      }
    },

    async registerUser() {
      // Validate all fields first
      this.validateFullName()
      this.validateEmail()
      this.validatePassword()
      this.validateConfirmPassword()

      if (!this.termsAccepted) {
        this.errors.terms = 'You must accept the Terms and Conditions'
      }

      // Check if form is valid
      if (!this.isFormValid) {
        return
      }

      this.isSubmitting = true
      this.registrationError = ''

      try {
        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, this.email, this.password)

        const user = userCredential.user

        // Store user temporarily for resending verification
        this.tempUser = user

        // Send email verification
        await sendEmailVerification(user)

        // Save additional user data to database
        const userRef = dbRef(db, `users/${user.uid}`)
        await set(userRef, {
          fullName: this.fullName,
          email: this.email,
          createdAt: Date.now(),
          isAdmin: false, // Default to non-admin
          emailVerified: false
        })

        // Show success message
        this.registrationSuccess = true

        // Start delayed logout countdown
        this.startLogoutCountdown()

        // Reset form fields but keep email for reference
        const registeredEmail = this.email
        this.fullName = ''
        this.password = ''
        this.confirmPassword = ''
        this.termsAccepted = false
        this.email = registeredEmail
      } catch (error) {
        console.error('Registration error:', error)

        // Handle specific Firebase errors
        switch (error.code) {
          case 'auth/email-already-in-use':
            this.registrationError = 'This email address is already in use.'
            break
          case 'auth/invalid-email':
            this.registrationError = 'The email address is not valid.'
            break
          case 'auth/operation-not-allowed':
            this.registrationError = 'Email/password accounts are not enabled.'
            break
          case 'auth/weak-password':
            this.registrationError = 'The password is too weak.'
            break
          default:
            this.registrationError = 'An error occurred during registration. Please try again.'
        }
      } finally {
        this.isSubmitting = false
      }
    }
  }
}
</script>

<style scoped>
.signup-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 30px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

label {
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

input[type='text'],
input[type='email'],
input[type='password'] {
  width: 93%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  color: #2c3e50;
  background-color: #fff;
  transition: border-color 0.3s;
}

input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.error-input {
  border-color: #f44336 !important;
}

.error-message {
  color: #f44336;
  font-size: 14px;
  margin-top: 5px;
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

.password-strength {
  margin-top: 10px;
}

.strength-label {
  font-size: 14px;
  margin-bottom: 5px;
  color: #666;
}

.strength-meter {
  height: 5px;
  background-color: #eee;
  border-radius: 3px;
  overflow: hidden;
}

.strength-value {
  height: 100%;
  transition: width 0.3s, background-color 0.3s;
}

.very-weak {
  background-color: #f44336;
}

.weak {
  background-color: #ff9800;
}

.medium {
  background-color: #ffeb3b;
}

.strong {
  background-color: #8bc34a;
}

.very-strong {
  background-color: #4caf50;
}

.strength-text {
  font-size: 12px;
  margin-top: 5px;
  text-align: right;
}

.password-requirements {
  margin-top: 15px;
  font-size: 14px;
  color: #666;
}

.password-requirements p {
  margin-bottom: 5px;
}

.password-requirements ul {
  padding-left: 20px;
  margin: 0;
}

.password-requirements li {
  margin-bottom: 3px;
}

.requirement-met {
  color: #4caf50;
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.checkbox-group label {
  margin-bottom: 0;
}

.checkbox-group a {
  color: #2196f3;
  text-decoration: none;
}

.checkbox-group a:hover {
  text-decoration: underline;
}

.form-actions {
  margin-top: 10px;
}

.signup-button {
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

.signup-button:hover {
  background-color: #45a049;
}

.signup-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.login-link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #666;
}

.login-link a {
  color: #2196f3;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}

/* Verification Container Styles */
.verification-container {
  text-align: center;
}

.success-icon {
  font-size: 48px;
  color: #4caf50;
  margin-bottom: 20px;
  background-color: #e8f5e9;
  width: 80px;
  height: 80px;
  line-height: 80px;
  border-radius: 50%;
  margin: 0 auto 20px;
}

.verification-card {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 0;
  margin: 30px 0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.verification-header {
  background-color: #e3f2fd;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.email-icon {
  font-size: 24px;
}

.verification-header h4 {
  margin: 0;
  color: #1976d2;
}

.verification-content {
  padding: 20px;
  text-align: left;
}

.email-address {
  background-color: #fff;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  margin: 10px 0 20px;
  font-weight: bold;
  text-align: center;
}

.verification-steps {
  margin-bottom: 20px;
}

.verification-steps ol {
  padding-left: 20px;
}

.verification-steps li {
  margin-bottom: 8px;
}

.verification-note {
  background-color: #fff3e0;
  padding: 15px;
  border-radius: 4px;
  margin-top: 20px;
}

.resend-button {
  background-color: #ff9800;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.resend-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.auto-logout-notice {
  background-color: #ffebee;
  padding: 10px;
  border-radius: 4px;
  margin: 20px 0;
}

.countdown-container {
  font-size: 14px;
}

.countdown {
  font-weight: bold;
  color: #f44336;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

.home-button,
.login-button {
  display: inline-block;
  padding: 10px 20px;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.home-button {
  background-color: #4caf50;
  color: white;
}

.home-button:hover {
  background-color: #45a049;
}

.login-button {
  background-color: #2196f3;
  color: white;
}

.login-button:hover {
  background-color: #0b7dda;
}

.registration-error {
  margin-top: 20px;
  padding: 10px 15px;
  background-color: #f2dede;
  color: #a94442;
  border-radius: 4px;
  text-align: center;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  color: #2c3e50;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
  max-height: 50vh;
  overflow-y: auto;
}

.modal-body h4 {
  margin-top: 20px;
  margin-bottom: 10px;
}

.modal-body h4:first-child {
  margin-top: 0;
}

.modal-body p {
  margin-bottom: 15px;
  line-height: 1.5;
}

.modal-footer {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.accept-button {
  padding: 8px 16px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-button {
  padding: 8px 16px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

@media (max-width: 600px) {
  .signup-container {
    padding: 20px;
  }
}
</style>
