<template>
  <div class="qr-generator">
    <h2>Attendance QR Code Generator</h2>

    <div class="session-form" v-if="!activeSession">
      <div class="form-group">
        <label for="session-type">Session Type:</label>
        <select id="session-type" v-model="sessionType">
          <option value="morning">Morning Session (6 AM - 6 PM)</option>
          <option value="day">Day Session (8 AM - 6 PM)</option>
          <option value="full-day">Full Day Session (24 Hours)</option>
          <option value="custom">Custom Session</option>
        </select>
      </div>

      <div v-if="sessionType === 'custom'" class="custom-times">
        <div class="form-group">
          <label for="start-time">Start Time:</label>
          <input type="time" id="start-time" v-model="startTime" />
        </div>

        <div class="form-group">
          <label for="end-time">End Time:</label>
          <input type="time" id="end-time" v-model="endTime" />
        </div>
      </div>

      <div class="form-group">
        <label for="session-date">Date:</label>
        <input type="date" id="session-date" v-model="sessionDate" />
      </div>

      <div class="form-group">
        <label for="auto-reset">Auto Reset:</label>
        <div class="checkbox-container">
          <input type="checkbox" id="auto-reset" v-model="autoReset" />
          <span class="checkbox-label">Automatically reset QR code</span>
        </div>
      </div>

      <button @click="generateQRCode" class="generate-btn" :disabled="loading">
        {{ loading ? 'Generating...' : 'Generate QR Code' }}
      </button>
    </div>

    <div v-else class="active-session">
      <div class="session-info">
        <h3>Active Session</h3>
        <p><strong>Date:</strong> {{ formatDate(activeSession.date) }}</p>
        <p><strong>Type:</strong> {{ getSessionTypeDisplay(activeSession.type) }}</p>
        <p><strong>Valid from:</strong> {{ formatTime(activeSession.startTime) }}</p>
        <p><strong>Valid until:</strong> {{ formatTime(activeSession.endTime) }}</p>
        <p><strong>Attendees:</strong> {{ attendeeCount }}</p>
        <p v-if="activeSession.autoReset" class="auto-reset-info">
          <span class="auto-reset-badge">Auto Reset</span>
          QR code will automatically reset every day
        </p>
      </div>

      <div class="qr-container">
        <div class="qr-code">
          <qrcode-vue :value="qrValue" :size="300" level="H"></qrcode-vue>
        </div>

        <p class="instructions">
          Employees can scan this QR code to mark their attendance during the valid time period.
        </p>

        <div class="action-buttons">
          <button @click="printQRCode" class="print-btn">Print QR Code</button>
          <button @click="refreshQRCode" class="refresh-btn">Refresh QR Code</button>
          <button @click="endSession" class="end-btn">End Session</button>
        </div>
      </div>

      <div class="remote-options">
        <h3>Remote Work Options</h3>
        <p>Share this link with remote workers:</p>
        <div class="remote-link">
          <input type="text" :value="remoteLink" readonly ref="remoteLink" />
          <button @click="copyRemoteLink" class="copy-btn">Copy</button>
        </div>
        <p v-if="linkCopied" class="copy-message">Link copied to clipboard!</p>
      </div>

      <div class="next-reset" v-if="activeSession.autoReset">
        <h3>Next Automatic Reset</h3>
        <div class="countdown">{{ formatCountdown }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import QrcodeVue from 'qrcode.vue'
import { db } from '../firebase/config'
import { ref as dbRef, set, onValue, remove, get } from 'firebase/database'

export default {
  name: 'QRCodeGenerator',
  components: {
    QrcodeVue
  },
  data() {
    return {
      sessionType: 'day',
      startTime: '08:00',
      endTime: '18:00',
      sessionDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      autoReset: true,
      qrValue: '',
      sessionId: '',
      loading: false,
      activeSession: null,
      attendeeCount: 0,
      linkCopied: false,
      remoteLink: '',
      resetTimer: null,
      timeUntilReset: 0
    }
  },
  computed: {
    formatCountdown() {
      if (!this.timeUntilReset) return 'Calculating...'

      const hours = Math.floor(this.timeUntilReset / 3600000)
      const minutes = Math.floor((this.timeUntilReset % 3600000) / 60000)
      const seconds = Math.floor((this.timeUntilReset % 60000) / 1000)

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`
    }
  },
  mounted() {
    // Check for active session and if it needs to be reset
    this.checkActiveSessionAndReset()
  },
  beforeUnmount() {
    if (this.resetTimer) {
      clearInterval(this.resetTimer)
    }
  },
  methods: {
    async checkActiveSessionAndReset() {
      try {
        // Get active session
        const activeSessionRef = dbRef(db, 'active-session')
        const snapshot = await get(activeSessionRef)

        if (snapshot.exists()) {
          const activeSession = snapshot.val()

          // Check if auto-reset is enabled and if it's time to reset
          if (activeSession.autoReset && activeSession.nextResetTime && Date.now() >= activeSession.nextResetTime) {
            console.log('Auto-reset time reached, performing reset...')
            await this.performAutoReset(activeSession)
          }
        }

        // After potential reset, set up the regular listener
        this.setupActiveSessionListener()
      } catch (error) {
        console.error('Error checking for auto-reset:', error)
        // Continue with regular listener setup even if check fails
        this.setupActiveSessionListener()
      }
    },

    setupActiveSessionListener() {
      const activeSessionRef = dbRef(db, 'active-session')
      onValue(activeSessionRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val()
          this.activeSession = data
          this.sessionId = data.sessionId

          // Generate QR code
          this.qrValue = JSON.stringify({
            type: 'attendance-session',
            sessionId: this.sessionId,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime
          })

          // Generate remote link
          this.remoteLink = `${window.location.origin}/remote-attendance?session=${this.sessionId}`

          // Monitor attendee count
          this.monitorAttendees()

          // Set up auto-reset timer if enabled
          if (data.autoReset && data.nextResetTime) {
            this.setupAutoReset(data.nextResetTime)
          }
        } else {
          this.activeSession = null
          this.qrValue = ''
          this.sessionId = ''
          this.attendeeCount = 0

          if (this.resetTimer) {
            clearInterval(this.resetTimer)
            this.resetTimer = null
          }
        }
      })
    },

    async performAutoReset(currentSession) {
      try {
        // Get current session details
        const oldSessionId = currentSession.sessionId

        // Create a new session ID
        const newSessionId = 'session-' + Date.now().toString()

        // Calculate new reset time (24 hours from now)
        const nextResetTime = Date.now() + 24 * 60 * 60 * 1000

        // Create new session data
        const newSessionData = {
          date: currentSession.date,
          startTime: currentSession.startTime,
          endTime: currentSession.endTime,
          createdAt: Date.now(),
          type: currentSession.type,
          autoReset: true,
          nextResetTime: nextResetTime
        }

        // Save new session
        const sessionRef = dbRef(db, `attendance-sessions/${newSessionId}`)
        await set(sessionRef, newSessionData)

        // Update active session
        const activeSessionRef = dbRef(db, 'active-session')
        await set(activeSessionRef, {
          ...newSessionData,
          sessionId: newSessionId
        })

        // Archive the old session
        const archiveRef = dbRef(db, `archived-sessions/${oldSessionId}`)
        await set(archiveRef, {
          ...currentSession,
          archivedAt: Date.now()
        })

        console.log('QR code auto-reset complete')
      } catch (error) {
        console.error('Error during auto-reset:', error)
      }
    },

    setupAutoReset(nextResetTime) {
      // Clear any existing timer
      if (this.resetTimer) {
        clearInterval(this.resetTimer)
      }

      // Calculate time until next reset
      const updateCountdown = () => {
        const now = Date.now()
        this.timeUntilReset = Math.max(0, nextResetTime - now)

        // If time is up, reset the QR code
        if (this.timeUntilReset <= 0 && this.activeSession) {
          this.performAutoReset(this.activeSession)
          clearInterval(this.resetTimer)
          this.resetTimer = null
        }
      }

      // Update countdown immediately
      updateCountdown()

      // Set interval to update countdown every second
      this.resetTimer = setInterval(updateCountdown, 1000)
    },

    // Rest of the methods remain the same as in the previous version
    monitorAttendees() {
      if (!this.sessionId) return

      const attendeesRef = dbRef(db, `attendance-sessions/${this.sessionId}/attendees`)
      onValue(attendeesRef, (snapshot) => {
        if (snapshot.exists()) {
          this.attendeeCount = Object.keys(snapshot.val()).length
        } else {
          this.attendeeCount = 0
        }
      })
    },

    calculateNextResetTime(settings) {
      const now = new Date()
      const [hours, minutes] = settings.resetTime.split(':').map(Number)

      // Set next reset time to today at specified time
      const nextReset = new Date(now)
      nextReset.setHours(hours, minutes, 0, 0)

      // If that time has already passed today, add specified hours
      if (nextReset <= now) {
        nextReset.setTime(nextReset.getTime() + settings.resetHours * 60 * 60 * 1000)
      }

      return nextReset.getTime()
    },

    async generateQRCode() {
      this.loading = true

      try {
        // Calculate start and end times based on session type
        const selectedDate = new Date(this.sessionDate)
        let startDateTime, endDateTime

        if (this.sessionType === 'morning') {
          // 6 AM - 6 PM (12 hours)
          startDateTime = new Date(selectedDate)
          startDateTime.setHours(6, 0, 0, 0)

          endDateTime = new Date(selectedDate)
          endDateTime.setHours(18, 0, 0, 0)
        } else if (this.sessionType === 'day') {
          // 8 AM - 6 PM (10 hours)
          startDateTime = new Date(selectedDate)
          startDateTime.setHours(8, 0, 0, 0)

          endDateTime = new Date(selectedDate)
          endDateTime.setHours(18, 0, 0, 0)
        } else if (this.sessionType === 'full-day') {
          // 24 hours (midnight to midnight)
          startDateTime = new Date(selectedDate)
          startDateTime.setHours(0, 0, 0, 0)

          endDateTime = new Date(selectedDate)
          endDateTime.setHours(23, 59, 59, 999)
        } else {
          // Custom times
          const [startHour, startMinute] = this.startTime.split(':').map(Number)
          const [endHour, endMinute] = this.endTime.split(':').map(Number)

          startDateTime = new Date(selectedDate)
          startDateTime.setHours(startHour, startMinute, 0, 0)

          endDateTime = new Date(selectedDate)
          endDateTime.setHours(endHour, endMinute, 0, 0)
        }

        // Create a unique session ID
        this.sessionId = 'session-' + Date.now().toString()

        // Calculate next reset time (24 hours from now)
        // const nextResetTime = Date.now() + 24 * 60 * 60 * 1000

        // Get auto-reset settings
        const settingsRef = dbRef(db, 'settings/autoReset')
        const settingsSnapshot = await get(settingsRef)
        const resetSettings = settingsSnapshot.exists()
          ? settingsSnapshot.val()
          : {
              resetHours: 16, // Default to 16 hours
              resetTime: '08:00' // Default to 8 AM
            }

        // Calculate next reset time based on settings
        const nextResetTime = this.calculateNextResetTime(resetSettings)

        // Create attendance session in Firebase
        const sessionData = {
          date: this.sessionDate,
          startTime: startDateTime.getTime(),
          endTime: endDateTime.getTime(),
          createdAt: Date.now(),
          type: this.sessionType,
          autoReset: this.autoReset,
          nextResetTime: this.autoReset ? nextResetTime : null
        }

        // Save session data
        const sessionRef = dbRef(db, `attendance-sessions/${this.sessionId}`)
        await set(sessionRef, sessionData)

        // Set as active session
        const activeSessionRef = dbRef(db, 'active-session')
        await set(activeSessionRef, {
          ...sessionData,
          sessionId: this.sessionId
        })

        // The active session will be picked up by the onValue listener
      } catch (error) {
        console.error('Error generating QR code:', error)
        alert('Failed to generate QR code: ' + error.message)
      } finally {
        this.loading = false
      }
    },

    async refreshQRCode() {
      if (!this.activeSession) return

      try {
        // Create a new session ID but keep the same session details
        const oldSessionId = this.sessionId
        this.sessionId = 'session-' + Date.now().toString()

        // Calculate new reset time (24 hours from now)
        const nextResetTime = Date.now() + 24 * 60 * 60 * 1000

        // Copy session data to new ID
        const sessionData = {
          date: this.activeSession.date,
          startTime: this.activeSession.startTime,
          endTime: this.activeSession.endTime,
          createdAt: Date.now(),
          type: this.activeSession.type,
          autoReset: this.activeSession.autoReset,
          nextResetTime: this.activeSession.autoReset ? nextResetTime : null
        }

        // Save new session
        const sessionRef = dbRef(db, `attendance-sessions/${this.sessionId}`)
        await set(sessionRef, sessionData)

        // Update active session
        const activeSessionRef = dbRef(db, 'active-session')
        await set(activeSessionRef, {
          ...sessionData,
          sessionId: this.sessionId
        })

        // The active session will be updated by the onValue listener

        // Archive the old session
        const archiveRef = dbRef(db, `archived-sessions/${oldSessionId}`)
        await set(archiveRef, {
          ...this.activeSession,
          archivedAt: Date.now()
        })
      } catch (error) {
        console.error('Error refreshing QR code:', error)
        alert('Failed to refresh QR code: ' + error.message)
      }
    },

    async endSession() {
      if (!this.activeSession) return

      if (!confirm('Are you sure you want to end this attendance session?')) {
        return
      }

      try {
        // Archive the current session
        const archiveRef = dbRef(db, `archived-sessions/${this.sessionId}`)
        await set(archiveRef, {
          ...this.activeSession,
          archivedAt: Date.now()
        })

        // Remove active session
        const activeSessionRef = dbRef(db, 'active-session')
        await remove(activeSessionRef)

        // The active session will be cleared by the onValue listener
      } catch (error) {
        console.error('Error ending session:', error)
        alert('Failed to end session: ' + error.message)
      }
    },

    printQRCode() {
      const printWindow = window.open('', '_blank')

      const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance QR Code</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
          }
          .qr-container {
            margin: 20px auto;
            max-width: 400px;
          }
          .session-info {
            margin-top: 20px;
            text-align: left;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          @media print {
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <h2>Attendance QR Code</h2>
        <div class="qr-container">
          <img src="${document.querySelector('.qr-code canvas').toDataURL()}" alt="QR Code" style="width: 100%;">
        </div>
        <div class="session-info">
          <h3>Session Information</h3>
          <p><strong>Date:</strong> ${this.formatDate(this.activeSession.date)}</p>
          <p><strong>Valid from:</strong> ${this.formatTime(this.activeSession.startTime)}</p>
          <p><strong>Valid until:</strong> ${this.formatTime(this.activeSession.endTime)}</p>
          <p>Scan this QR code to mark your attendance.</p>
        </div>
        <div class="no-print">
          <button onclick="window.print()">Print</button>
        </div>
      </body>
      </html>
    `

      printWindow.document.open()
      printWindow.document.write(content)
      printWindow.document.close()
    },

    copyRemoteLink() {
      const linkInput = this.$refs.remoteLink
      linkInput.select()
      document.execCommand('copy')

      this.linkCopied = true
      setTimeout(() => {
        this.linkCopied = false
      }, 3000)
    },

    getSessionTypeDisplay(type) {
      if (type === 'morning') {
        return 'Morning Session (6 AM - 6 PM)'
      } else if (type === 'day') {
        return 'Day Session (8 AM - 6 PM)'
      } else if (type === 'full-day') {
        return 'Full Day Session (24 Hours)'
      } else if (type === 'custom') {
        return 'Custom Session'
      }
      return type || 'Unknown'
    },

    formatDate(dateString) {
      if (!dateString) return ''
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      return new Date(dateString).toLocaleDateString(undefined, options)
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      const options = { hour: '2-digit', minute: '2-digit', hour12: true }
      return new Date(timestamp).toLocaleTimeString(undefined, options)
    }
  }
}
</script>

<style scoped>
.qr-generator {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.session-form {
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

select,
input[type='date'],
input[type='time'] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.checkbox-container {
  display: flex;
  align-items: center;
}

input[type='checkbox'] {
  margin-right: 10px;
  width: 18px;
  height: 18px;
}

.checkbox-label {
  font-size: 16px;
}

.custom-times {
  display: flex;
  gap: 15px;
}

.custom-times .form-group {
  flex: 1;
}

.generate-btn {
  background-color: #4caf50;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

.generate-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.active-session {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.session-info {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.session-info h3 {
  margin-top: 0;
  color: #333;
}

.auto-reset-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.auto-reset-badge {
  background-color: #ff9800;
  color: white;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.qr-container {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  text-align: center;
}

.qr-code {
  display: flex;
  justify-content: center;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 15px;
}

.instructions {
  font-style: italic;
  color: #666;
  margin: 15px 0;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 15px;
}

.print-btn {
  background-color: #2196f3;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn {
  background-color: #ff9800;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.end-btn {
  background-color: #f44336;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.remote-options {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f0f8ff;
}

.remote-options h3 {
  margin-top: 0;
  color: #333;
}

.remote-link {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

.remote-link input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.copy-btn {
  background-color: #673ab7;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.copy-message {
  color: #4caf50;
  font-weight: bold;
  margin-top: 5px;
}

.next-reset {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff3e0;
  text-align: center;
}

.next-reset h3 {
  margin-top: 0;
  color: #333;
}

.countdown {
  font-size: 24px;
  font-weight: bold;
  color: #ff9800;
  margin: 10px 0;
}
</style>
