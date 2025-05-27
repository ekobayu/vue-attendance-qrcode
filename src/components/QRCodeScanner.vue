<template>
  <div class="qr-scanner">
    <div v-if="!scanning && !attendanceMarked">
      <button @click="startScanning" class="scan-btn">Start Scanner</button>
    </div>

    <div v-else-if="scanning" class="scanner-container">
      <qrcode-stream @decode="onDecode" @init="onInit"></qrcode-stream>
      <button @click="stopScanning" class="stop-btn">Stop Scanner</button>
    </div>

    <div v-else-if="attendanceMarked" class="success-container">
      <div class="success-icon">✓</div>
      <h3>Attendance Marked Successfully!</h3>
      <p>Date: {{ formatDate(markDate) }}</p>
      <p>Time: {{ formatTime(markTime) }}</p>
      <p>Session: {{ sessionType }}</p>
      <button @click="resetAttendance" class="reset-btn">Scan Another Code</button>
    </div>

    <div v-if="error && !attendanceMarked" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { QrcodeStream } from 'qrcode-reader-vue3'
import { auth, db } from '../firebase/config'
import { ref as dbRef, set, get, push } from 'firebase/database'

export default {
  name: 'QRCodeScanner',
  components: {
    QrcodeStream
  },
  data() {
    return {
      scanning: false,
      attendanceMarked: false,
      markTime: null,
      markDate: null,
      sessionType: '',
      error: null
    }
  },
  methods: {
    startScanning() {
      this.scanning = true
      this.error = null
    },

    stopScanning() {
      this.scanning = false
    },

    onInit(promise) {
      promise.catch((error) => {
        this.scanning = false
        if (error.name === 'NotAllowedError') {
          this.error = 'Camera access denied. Please grant permission.'
        } else if (error.name === 'NotFoundError') {
          this.error = 'No camera found on this device.'
        } else if (error.name === 'NotSupportedError') {
          this.error = 'Secure context required (HTTPS, localhost)'
        } else if (error.name === 'NotReadableError') {
          this.error = 'Camera already in use'
        } else if (error.name === 'OverconstrainedError') {
          this.error = 'Installed cameras are not suitable'
        } else {
          this.error = 'Error accessing camera: ' + error.message
        }
      })
    },

    async onDecode(decodedString) {
      this.stopScanning()

      try {
        const qrData = JSON.parse(decodedString)

        if (qrData.type === 'attendance-session' && qrData.sessionId) {
          // Check if there's an active session that needs reset
          await this.checkActiveSessionReset()

          // Continue with normal attendance marking
          await this.markAttendance(qrData)
        } else {
          this.error = 'Invalid QR code format. Please scan a valid attendance QR code.'
        }
      } catch (e) {
        this.error = 'Invalid QR code data. Please try again.'
      }
    },

    async markAttendance(qrData) {
      if (!auth.currentUser) {
        this.error = 'You must be logged in to mark attendance'
        return
      }

      try {
        // Check if session exists
        const sessionRef = dbRef(db, `attendance-sessions/${qrData.sessionId}`)
        const snapshot = await get(sessionRef)

        if (!snapshot.exists()) {
          this.error = 'Invalid attendance session'
          return
        }

        const sessionData = snapshot.val()
        const now = Date.now()

        // Check if the current time is within the valid time range
        if (now < sessionData.startTime) {
          this.error =
            'This attendance session has not started yet. It will be valid from ' +
            this.formatTime(sessionData.startTime)
          return
        }

        if (now > sessionData.endTime) {
          this.error = 'This attendance session has expired. It was valid until ' + this.formatTime(sessionData.endTime)
          return
        }

        // Set current time and date
        this.markTime = now
        this.markDate = sessionData.date

        // Set session type
        if (sessionData.type === 'office') {
          this.sessionType = 'Office (07.30 AM - 04.30 PM)'
        } else {
          this.sessionType = 'Custom Session'
        }

        const userId = auth.currentUser.uid
        const userEmail = auth.currentUser.email

        // Check if user already marked attendance for this session
        if (sessionData.attendees && sessionData.attendees[userId]) {
          this.error =
            'You have already marked your attendance for this session at ' +
            this.formatTime(sessionData.attendees[userId].timestamp)
          return
        }

        // Mark attendance in session
        const attendeeRef = dbRef(db, `attendance-sessions/${qrData.sessionId}/attendees/${userId}`)
        await set(attendeeRef, {
          email: userEmail,
          timestamp: this.markTime
        })

        // Also save to daily attendance records
        const dailyAttendanceRef = dbRef(db, `daily-attendance/${sessionData.date}`)
        const newAttendanceRef = push(dailyAttendanceRef)
        await set(newAttendanceRef, {
          userId: userId,
          email: userEmail,
          timestamp: this.markTime,
          sessionId: qrData.sessionId,
          sessionType: sessionData.type
        })

        // Also save to user's attendance history
        const userAttendanceRef = dbRef(db, `user-attendance/${userId}/${sessionData.date}`)
        await set(userAttendanceRef, {
          timestamp: this.markTime,
          recordId: newAttendanceRef.key,
          sessionType: sessionData.type
        })

        this.attendanceMarked = true
      } catch (error) {
        console.error('Error marking attendance:', error)
        this.error = 'Failed to mark attendance: ' + error.message
      }
    },

    async checkActiveSessionReset() {
      try {
        // Get active session
        const activeSessionRef = dbRef(db, 'active-session')
        const snapshot = await get(activeSessionRef)

        if (snapshot.exists()) {
          const activeSession = snapshot.val()

          // Check if auto-reset is enabled and if it's time to reset
          if (activeSession.autoReset && activeSession.nextResetTime && Date.now() >= activeSession.nextResetTime) {
            // console.log('Auto-reset time reached during scan, notifying admin...')

            // We don't perform the reset here, just notify that it's needed
            // This prevents race conditions if multiple users scan at the same time

            // Update a flag in the database that the admin panel will check
            const resetFlagRef = dbRef(db, 'reset-needed')
            await set(resetFlagRef, {
              sessionId: activeSession.sessionId,
              timestamp: Date.now()
            })
          }
        }
      } catch (error) {
        console.error('Error checking for auto-reset:', error)
        // Continue with attendance marking even if check fails
      }
    },

    resetAttendance() {
      this.attendanceMarked = false
      this.markTime = null
      this.markDate = null
      this.sessionType = ''
      this.error = null
    },

    formatDate(dateString) {
      if (!dateString) return ''
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      return new Date(dateString).toLocaleDateString(undefined, options)
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }
      return new Date(timestamp).toLocaleTimeString(undefined, options)
    }
  }
}
</script>

<style scoped>
.qr-scanner {
  max-width: 500px;
  margin: 0 auto;
  /* padding: 20px; */
  background-color: #fff;
  border-radius: 8px;
  /* box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); */
}

.instructions {
  margin: 20px 0;
  color: #555;
  font-size: 16px;
  text-align: center;
}

.scan-btn {
  background-color: #4caf50;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: block;
  margin: 20px auto;
}

.stop-btn {
  background-color: #f44336;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 15px;
}

.scanner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 20px 0;
}

.success-container {
  text-align: center;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.success-icon {
  font-size: 48px;
  color: #4caf50;
  margin-bottom: 10px;
  background-color: #e8f5e9;
  width: 80px;
  height: 80px;
  line-height: 80px;
  border-radius: 50%;
  margin: 0 auto 20px;
}

.reset-btn {
  background-color: #ff9800;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 20px;
}

.error-message {
  margin-top: 20px;
  padding: 10px 15px;
  background-color: #f2dede;
  color: #a94442;
  border-radius: 4px;
  text-align: center;
}
</style>
