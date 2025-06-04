<template>
  <div class="qr-display full-screen">
    <div class="qr-container">
      <div class="header">
        <h2>Attendance QR Code</h2>
      </div>
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Loading QR code...</p>
      </div>
      <div v-else-if="error" class="error">
        {{ error }}
      </div>
      <div v-else-if="!session" class="no-session">
        <p>No active attendance session found.</p>
        <p>Please generate a QR code from the admin panel.</p>
      </div>
      <div v-else class="qr-content">
        <qrcode-vue :value="qrValue" :size="300" level="H" class="qr-image"></qrcode-vue>
        <div class="session-info">
          <h3>Session Information</h3>
          <p><strong>Date:</strong> {{ formatDate(session.date) }}</p>
          <p><strong>Type:</strong> {{ getSessionTypeDisplay(session.type) }}</p>
          <p><strong>Time</strong> {{ formatTime(session.startTime) }} - {{ formatTime(session.endTime) }}</p>
          <div class="scan-info">
            <p><strong>Scan Limit:</strong> 2 scans per day</p>
            <p>First scan: Check-in | Second scan: Check-out</p>
          </div>
        </div>
        <div v-if="session.autoReset" class="auto-refresh">
          <p>This QR code will automatically refresh at the next scheduled time.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import QrcodeVue from 'qrcode.vue'
import { db } from '../firebase/config'
import { ref as dbRef, onValue } from 'firebase/database'

export default {
  name: 'QRDisplay',
  components: {
    QrcodeVue
  },
  data() {
    return {
      session: null,
      qrValue: '',
      loading: true,
      error: null,
      refreshInterval: null,
      countdownInterval: null
    }
  },
  mounted() {
    this.setupActiveSessionListener()

    // Set up auto-refresh every minute to keep the page updated
    this.refreshInterval = setInterval(() => {
      // This is just a backup - the Firebase listener should handle updates
      this.updateCountdown()
    }, 60 * 1000)
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
    }
  },
  methods: {
    setupActiveSessionListener() {
      const activeSessionRef = dbRef(db, 'active-session')

      onValue(
        activeSessionRef,
        (snapshot) => {
          this.loading = false

          if (snapshot.exists()) {
            const data = snapshot.val()
            this.session = data

            // Generate QR code value with scan limit information
            this.qrValue = JSON.stringify({
              type: 'attendance-session',
              sessionId: data.sessionId,
              date: data.date,
              startTime: data.startTime,
              endTime: data.endTime,
              scanLimit: 2, // Add scan limit information
              version: 2 // Add version to indicate new format
            })

            // Set up countdown timer if auto-reset is enabled
            if (data.autoReset && data.nextResetTime) {
              this.setupCountdown()
            }
          } else {
            this.error = null
            this.session = null
            this.qrValue = ''
          }
        },
        (error) => {
          this.loading = false
          this.error = 'Error loading QR code: ' + error.message
        }
      )
    },

    setupCountdown() {
      // Clear any existing countdown
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval)
      }

      // Update countdown immediately
      this.updateCountdown()

      // Then update every second
      this.countdownInterval = setInterval(() => {
        this.updateCountdown()
      }, 1000)
    },

    updateCountdown() {
      // If no session or no next reset time, do nothing
      if (!this.session || !this.session.nextResetTime) return

      const now = Date.now()
      const nextReset = this.session.nextResetTime

      // If reset time has passed, the Firebase listener should handle the update
      // This is just a fallback in case the listener doesn't trigger
      if (now >= nextReset) {
        // Force reload the page after a short delay
        setTimeout(() => {
          window.location.reload()
        }, 5000)
      }
    },

    formatDate(dateString) {
      if (!dateString) return ''

      // Use local date functions to ensure correct timezone
      const date = new Date(dateString)
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      return date.toLocaleDateString(undefined, options)
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    },

    formatNextReset(timestamp) {
      if (!timestamp) return ''

      const now = Date.now()
      const timeLeft = Math.max(0, timestamp - now)

      // If less than a minute, show seconds
      if (timeLeft < 60000) {
        return `${Math.floor(timeLeft / 1000)} seconds`
      }

      // If less than an hour, show minutes
      if (timeLeft < 3600000) {
        return `${Math.floor(timeLeft / 60000)} minutes`
      }

      // Otherwise show hours and minutes
      const hours = Math.floor(timeLeft / 3600000)
      const minutes = Math.floor((timeLeft % 3600000) / 60000)
      return `${hours} hours, ${minutes} minutes`
    },

    getSessionTypeDisplay(type) {
      if (type === 'office') {
        return 'Office'
      } else if (type === 'custom') {
        return 'Custom Session'
      }
      return type || 'Unknown'
    }
  }
}
</script>

<style scoped>
nav {
  display: none;
}
.qr-display.full-screen {
  min-height: 100vh;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
}

.qr-container {
  max-width: 500px;
  width: 100%;
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  margin: 20px;
}

.header {
  background-color: #4caf50;
  color: white;
  padding: 15px;
  margin: -30px -30px 20px -30px;
  border-radius: 8px 8px 0 0;
  text-align: center;
}

.qr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-image {
  margin: 20px 0;
}

.session-info {
  width: 100%;
  margin-top: 20px;
  text-align: left;
  border-top: 1px solid #ddd;
  padding-top: 20px;
}

.scan-info {
  margin-top: 15px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
  border-left: 3px solid #4caf50;
}

.auto-refresh {
  margin-top: 20px;
  font-size: 14px;
  color: #666;
  text-align: center;
  padding: 15px;
  background-color: #fff3e0;
  border-radius: 4px;
  width: 100%;
}

.next-reset {
  margin-top: 10px;
  font-weight: bold;
}

.countdown {
  color: #ff9800;
}

.loading,
.error,
.no-session {
  padding: 40px;
  text-align: center;
  color: #666;
}

.error {
  color: #f44336;
}

.no-session {
  color: #607d8b;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #4caf50;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
