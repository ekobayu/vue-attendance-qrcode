<template>
  <div class="qr-generator">
    <h2>Attendance QR Code Generator</h2>

    <div class="session-form" v-if="!activeSession">
      <div class="form-group">
        <label for="session-type">Session Type:</label>
        <select id="session-type" v-model="sessionType">
          <option value="office">Office (07:30 AM - 04:30 PM)</option>
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
        <!-- <p><strong>Valid from:</strong> {{ formatTime(activeSession.startTime) }}</p>
        <p><strong>Valid until:</strong> {{ formatTime(activeSession.endTime) }}</p> -->
        <p><strong>Attendees:</strong> {{ attendeeCount }}</p>
        <div class="scan-limit-info">
          <span class="scan-limit-badge">2 Scans Per Day</span><br />
          <span class="scan-limit-text">First scan: Check-in | Second scan: Check-out</span>
        </div>
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
          <br />
          <strong>Each employee is limited to 2 scans per day (check-in and check-out).</strong>
        </p>

        <div class="action-buttons">
          <button @click="printQRCode" class="print-btn">Print QR Code</button>
          <button @click="openInNewTab" class="new-tab-btn">Open in New Tab</button>
          <!-- <button @click="refreshQRCode" class="refresh-btn">Refresh QR Code</button> -->
          <button @click="endSession" class="end-btn">End Session</button>
        </div>
      </div>

      <!-- <div class="remote-options">
        <h3>Remote Work Options</h3>
        <p>Share this link with remote workers:</p>
        <div class="remote-link">
          <input type="text" :value="remoteLink" readonly ref="remoteLink" />
          <button @click="copyRemoteLink" class="copy-btn">Copy</button>
        </div>
        <p v-if="linkCopied" class="copy-message">Link copied to clipboard!</p>
      </div> -->

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
import { getTodayDateString } from '@/services/getTodayDateString'

export default {
  name: 'QRCodeGenerator',
  components: {
    QrcodeVue
  },
  data() {
    return {
      sessionType: 'office',
      startTime: '07:30',
      endTime: '16:30',
      sessionDate: getTodayDateString(), // Today's date in YYYY-MM-DD format
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

      // Check if timeUntilReset is valid
      if (isNaN(this.timeUntilReset)) {
        console.error('Invalid timeUntilReset value:', this.timeUntilReset)
        return 'Invalid time'
      }

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
    openInNewTab() {
      if (!this.activeSession) return

      // Open the QR display page in a new tab - no session ID needed in URL
      const url = `${window.location.origin}/qr-display`
      window.open(url, '_blank')
    },
    async checkActiveSessionAndReset() {
      try {
        console.log('Checking for active session and reset conditions...')

        // Now check if the active session itself needs reset
        const activeSessionRef = dbRef(db, 'active-session')
        const snapshot = await get(activeSessionRef)

        if (snapshot.exists()) {
          const activeSession = snapshot.val()
          // console.log('Found active session:', {
          //   id: activeSession.sessionId,
          //   date: activeSession.date,
          //   type: activeSession.type,
          //   autoReset: activeSession.autoReset,
          //   nextResetTime: activeSession.nextResetTime ? new Date(activeSession.nextResetTime).toString() : 'not set'
          // })

          // Check if auto-reset is enabled and if it's time to reset
          const now = Date.now()
          if (activeSession.autoReset && activeSession.nextResetTime) {
            const timeUntilReset = activeSession.nextResetTime - now
            console.log(`Time until reset: ${Math.floor(timeUntilReset / 60000)} minutes`)

            if (now >= activeSession.nextResetTime) {
              console.log('Auto-reset time reached, performing reset...')
              await this.performAutoReset(activeSession)
            }
          } else if (activeSession.autoReset && !activeSession.nextResetTime) {
            // If auto-reset is enabled but no nextResetTime is set, set it to tomorrow at 7:30 AM
            console.log('Auto-reset is enabled but no nextResetTime is set')

            // Calculate next reset time - always set to tomorrow at 7:30 AM
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            tomorrow.setHours(7, 30, 0, 0)

            // If tomorrow is a weekend, adjust to Monday
            if (tomorrow.getDay() === 0) {
              // Sunday
              tomorrow.setDate(tomorrow.getDate() + 1) // Skip to Monday
            } else if (tomorrow.getDay() === 6) {
              // Saturday
              tomorrow.setDate(tomorrow.getDate() + 2) // Skip to Monday
            }

            const nextResetTime = tomorrow.getTime()
            // console.log('Setting next reset time to:', tomorrow.toString())

            // Update the session with the next reset time
            await set(activeSessionRef, {
              ...activeSession,
              nextResetTime: nextResetTime
            })
          }
        } else {
          console.log('No active session found')
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

          // Generate QR code with scan limit information
          this.qrValue = JSON.stringify({
            type: 'attendance-session',
            sessionId: this.sessionId,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            scanLimit: 2, // Add scan limit information
            version: 2 // Add version to indicate new format
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
        console.log('Starting auto-reset process...')

        // Get current session details
        const oldSessionId = currentSession.sessionId
        const now = Date.now()

        // Get today's date in YYYY-MM-DD format - ALWAYS use current date
        const today = getTodayDateString()

        // Create a new session ID
        const newSessionId = 'session-' + now.toString()

        // Calculate next reset time - always set to tomorrow at 7:30 AM
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(7, 30, 0, 0)

        // If tomorrow is a weekend, adjust to Monday
        if (tomorrow.getDay() === 0) {
          // Sunday
          tomorrow.setDate(tomorrow.getDate() + 1) // Skip to Monday
        } else if (tomorrow.getDay() === 6) {
          // Saturday
          tomorrow.setDate(tomorrow.getDate() + 2) // Skip to Monday
        }

        const nextResetTime = tomorrow.getTime()

        // Create new session data with today's date - always office session
        const newSessionData = {
          date: today, // ALWAYS use current date
          startTime: this.calculateSessionStartTime('office', today),
          endTime: this.calculateSessionEndTime('office', today),
          createdAt: now,
          type: 'office',
          autoReset: true,
          nextResetTime: nextResetTime,
          scanLimit: 2, // Add scan limit
          version: 2 // Add version
        }

        // console.log('Creating new office session with data:', {
        //   date: newSessionData.date,
        //   startTime: new Date(newSessionData.startTime).toLocaleTimeString(),
        //   endTime: new Date(newSessionData.endTime).toLocaleTimeString(),
        //   nextResetTime: new Date(nextResetTime).toString()
        // })

        // First archive the old session
        const archiveRef = dbRef(db, `archived-sessions/${oldSessionId}`)
        await set(archiveRef, {
          ...currentSession,
          archivedAt: now
        })
        console.log('Old session archived successfully')

        // Then save new session
        const sessionRef = dbRef(db, `attendance-sessions/${newSessionId}`)
        await set(sessionRef, newSessionData)
        console.log('New session created successfully')

        // Finally update active session
        const activeSessionRef = dbRef(db, 'active-session')
        await set(activeSessionRef, {
          ...newSessionData,
          sessionId: newSessionId
        })
        console.log('Active session updated successfully')

        console.log('QR code auto-reset complete with new office session')
        return true // Return true to indicate successful reset
      } catch (error) {
        console.error('Error during auto-reset:', error)
        return false // Return false to indicate failed reset
      }
    },

    calculateSessionStartTime(sessionType, dateString) {
      // Create a fresh Date object from the dateString
      const selectedDate = new Date()

      // If dateString is provided and valid, use it
      if (dateString) {
        const parts = dateString.split('-')
        if (parts.length === 3) {
          selectedDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        }
      }

      if (sessionType === 'office') {
        // 7:30 AM
        selectedDate.setHours(7, 30, 0, 0)
        return selectedDate.getTime()
      } else if (sessionType === 'custom') {
        // Use the custom time settings
        const [startHour, startMinute] = this.startTime.split(':').map(Number)
        selectedDate.setHours(startHour, startMinute, 0, 0)
        return selectedDate.getTime()
      } else {
        // Default to 7:30 AM
        selectedDate.setHours(7, 30, 0, 0)
        return selectedDate.getTime()
      }
    },

    calculateSessionEndTime(sessionType, dateString) {
      // Create a fresh Date object from the dateString
      const selectedDate = new Date()

      // If dateString is provided and valid, use it
      if (dateString) {
        const parts = dateString.split('-')
        if (parts.length === 3) {
          selectedDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        }
      }

      if (sessionType === 'office') {
        // 4:30 PM
        selectedDate.setHours(16, 30, 0, 0)
        return selectedDate.getTime()
      } else if (sessionType === 'custom') {
        // Use the custom time settings
        const [endHour, endMinute] = this.endTime.split(':').map(Number)
        selectedDate.setHours(endHour, endMinute, 0, 0)
        return selectedDate.getTime()
      } else {
        // Default to 4:30 PM
        selectedDate.setHours(16, 30, 0, 0)
        return selectedDate.getTime()
      }
    },

    setupAutoReset(nextResetTime) {
      // Clear any existing timer
      if (this.resetTimer) {
        clearInterval(this.resetTimer)
        this.resetTimer = null
      }

      // Validate nextResetTime
      if (!nextResetTime || isNaN(nextResetTime)) {
        console.error('Invalid nextResetTime:', nextResetTime)
        return
      }

      // Calculate time until next reset
      const updateCountdown = () => {
        const currentTime = Date.now()
        this.timeUntilReset = Math.max(0, nextResetTime - currentTime)

        // If time is up, reset the QR code
        if (this.timeUntilReset <= 0 && this.activeSession) {
          // Stop the timer immediately to prevent multiple calls
          if (this.resetTimer) {
            clearInterval(this.resetTimer)
            this.resetTimer = null
          }

          // Perform the reset
          this.performAutoReset(this.activeSession)
        }
      }

      // Update countdown immediately
      updateCountdown()

      // Set interval to update countdown every second
      this.resetTimer = setInterval(updateCountdown, 1000)
    },

    monitorAttendees() {
      if (!this.sessionId) return

      const attendeesRef = dbRef(db, `attendance-sessions/${this.sessionId}/attendees`)
      onValue(attendeesRef, (snapshot) => {
        if (snapshot.exists()) {
          const attendees = snapshot.val()

          // Count unique users by extracting user IDs from the keys
          const uniqueUserIds = new Set()

          Object.keys(attendees).forEach((key) => {
            // Extract user ID from the key (either plain userId or userId_timestamp format)
            const userId = key.split('_')[0] // This will get the userId part
            uniqueUserIds.add(userId)
          })

          // Set the count to the number of unique users
          this.attendeeCount = uniqueUserIds.size
        } else {
          this.attendeeCount = 0
        }
      })
    },

    async generateQRCode() {
      this.loading = true

      try {
        // Always use current date - get fresh date each time
        const today = getTodayDateString()

        // Calculate start and end times based on session type
        const selectedDate = new Date() // Use a fresh Date object
        let startDateTime, endDateTime

        if (this.sessionType === 'office') {
          // 7:30 AM - 4:30 PM (9 hours)
          startDateTime = new Date(selectedDate)
          startDateTime.setHours(7, 30, 0, 0)

          endDateTime = new Date(selectedDate)
          endDateTime.setHours(16, 30, 0, 0)
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

        // Calculate next reset time - always set to tomorrow at 7:30 AM
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(7, 30, 0, 0)

        // If tomorrow is a weekend, adjust to Monday
        if (tomorrow.getDay() === 0) {
          // Sunday
          tomorrow.setDate(tomorrow.getDate() + 1) // Skip to Monday
        } else if (tomorrow.getDay() === 6) {
          // Saturday
          tomorrow.setDate(tomorrow.getDate() + 2) // Skip to Monday
        }

        const nextResetTime = tomorrow.getTime()

        // Create attendance session in Firebase
        const sessionData = {
          date: today,
          startTime: startDateTime.getTime(),
          endTime: endDateTime.getTime(),
          createdAt: Date.now(),
          type: this.sessionType,
          autoReset: this.autoReset,
          nextResetTime: this.autoReset ? nextResetTime : null,
          scanLimit: 2, // Add scan limit
          version: 2 // Add version
        }

        // console.log('Creating new session with data:', {
        //   date: sessionData.date,
        //   type: this.sessionType,
        //   startTime: new Date(sessionData.startTime).toLocaleTimeString(),
        //   endTime: new Date(sessionData.endTime).toLocaleTimeString()
        // })

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

        // Get today's date in YYYY-MM-DD format - ALWAYS use current date
        const today = getTodayDateString()

        // Check if today is a weekend
        if (this.isWeekend(today)) {
          // Show a confirmation dialog before proceeding on weekends
          if (!confirm('Today is a weekend. Are you sure you want to create a new session?')) {
            return // Exit if user cancels
          }
        }

        // Get auto-reset settings
        const settingsRef = dbRef(db, 'settings/autoReset')
        const settingsSnapshot = (await get(settingsRef))
          ? settingsSnapshot.val()
          : {
              resetTime: '07:30',
              resetHours: 16
            }

        // Calculate next reset time - always set to tomorrow at 7:30 AM
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(7, 30, 0, 0)

        // If tomorrow is a weekend, adjust to Monday
        if (tomorrow.getDay() === 0) {
          // Sunday
          tomorrow.setDate(tomorrow.getDate() + 1) // Skip to Monday
        } else if (tomorrow.getDay() === 6) {
          // Saturday
          tomorrow.setDate(tomorrow.getDate() + 2) // Skip to Monday
        }

        const nextResetTime = tomorrow.getTime()

        // Ask if user wants to create an office session or keep the current type
        const createOfficeSession = confirm(
          'Do you want to create a new office session?\n\n' +
            'Click "OK" to create an office session.\n' +
            'Click "Cancel" to keep the current session type.'
        )

        // Determine session type based on user choice
        const sessionType = createOfficeSession ? 'office' : this.activeSession.type

        // Create new session data with today's date
        const sessionData = {
          date: today, // ALWAYS use current date
          startTime: this.calculateSessionStartTime(sessionType, today),
          endTime: this.calculateSessionEndTime(sessionType, today),
          createdAt: Date.now(),
          type: sessionType, // Use the determined session type
          autoReset: this.activeSession.autoReset,
          nextResetTime: this.activeSession.autoReset ? nextResetTime : null,
          scanLimit: 2, // Add scan limit
          version: 2 // Add version
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

        // Archive the old session
        const archiveRef = dbRef(db, `archived-sessions/${oldSessionId}`)
        await set(archiveRef, {
          ...this.activeSession,
          archivedAt: Date.now()
        })

        alert('Session refreshed successfully with current date.')
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
        .scan-limit {
          margin-top: 15px;
          padding: 10px;
          background-color: #e8f5e9;
          border-radius: 4px;
          border-left: 3px solid #4caf50;
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
        <div class="scan-limit">
          <p><strong>Scan Limit:</strong> 2 scans per day</p>
          <p>First scan: Check-in | Second scan: Check-out</p>
        </div>
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
      if (type === 'office') {
        return 'Office (07:30 AM - 04:30 PM)'
      } else if (type === 'morning') {
        // For backward compatibility
        return 'Morning (07:30 AM - 04:30 PM)'
      } else if (type === 'custom') {
        return 'Custom Session'
      }
      return type || 'Unknown'
    },

    isWeekend(date) {
      const dayOfWeek = new Date(date).getDay()
      // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      if (isWeekend) {
        console.log(`Date ${date} is a weekend (day ${dayOfWeek})`)
      }
      return isWeekend
    },

    formatDate(dateString) {
      if (!dateString) return ''
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      return new Date(dateString).toLocaleDateString(undefined, options)
    },

    formatTime(timestamp) {
      if (!timestamp) return ''

      // Check if timestamp is a string in HH:MM format
      if (typeof timestamp === 'string' && timestamp.includes(':')) {
        const [hours, minutes] = timestamp.split(':').map(Number)
        const date = new Date()
        date.setHours(hours, minutes, 0, 0)
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
      }

      // Otherwise treat as timestamp
      return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
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

.new-tab-btn {
  background-color: #009688;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.new-tab-btn:hover {
  background-color: #00796b;
}

/* Adjust the action buttons to ensure they fit nicely */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 15px;
  flex-wrap: wrap;
}

@media (max-width: 600px) {
  .action-buttons button {
    flex: 1 0 calc(50% - 10px);
    margin-bottom: 10px;
  }
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
