<template>
  <div class="qr-scanner">
    <!-- Scan Status Display -->
    <!-- <div v-if="todayScans" class="scan-status-display">
      <h3>Today's Attendance</h3>
      <div class="scan-details">
        <div class="scan-row">
          <div class="scan-label">Check-in:</div>
          <div v-if="todayScans.firstScan" class="scan-time">
            {{ formatTime(todayScans.firstScan) }}
            <span class="scan-badge success">Recorded</span>
          </div>
          <div v-else class="scan-time">
            Not recorded
            <span class="scan-badge pending">Pending</span>
          </div>
        </div>

        <div class="scan-row">
          <div class="scan-label">Check-out:</div>
          <div v-if="todayScans.secondScan" class="scan-time">
            {{ formatTime(todayScans.secondScan) }}
            <span class="scan-badge success">Recorded</span>
          </div>
          <div v-else class="scan-time">
            Not recorded
            <span class="scan-badge pending">Pending</span>
          </div>
        </div>
      </div>

      <div class="scan-limit-info">
        <span v-if="scanCount >= 2" class="limit-reached">Daily scan limit reached</span>
        <span v-else>{{ 2 - scanCount }} scans remaining today</span>
      </div>
    </div> -->

    <!-- Scanner Controls -->
    <div v-if="!scanning && !attendanceMarked && scanCount < 2">
      <button @click="startScanning" class="scan-btn">
        {{ scanCount === 0 ? 'Scan to Check In' : 'Scan to Check Out' }}
      </button>
    </div>
    <div v-else-if="!scanning && !attendanceMarked && scanCount >= 2" class="limit-message">
      <div class="limit-icon">✓</div>
      <h3>Daily Scan Limit Reached</h3>
      <p>You have already completed both check-in and check-out for today.</p>
    </div>

    <div v-else-if="scanning" class="scanner-container">
      <qrcode-stream @decode="onDecode" @init="onInit"></qrcode-stream>
      <button @click="stopScanning" class="stop-btn">Stop Scanner</button>
    </div>

    <div v-else-if="attendanceMarked" class="success-container">
      <div class="success-icon">✓</div>
      <h3>{{ scanCount === 1 ? 'Check-In Recorded!' : 'Check-Out Recorded!' }}</h3>
      <p>Date: {{ formatDate(markDate) }}</p>
      <p>Time: {{ formatTime(markTime) }}</p>
      <p>Session: {{ sessionType }}</p>

      <button v-if="scanCount < 2" @click="resetAttendance" class="reset-btn">Close</button>
      <p v-else class="limit-note">Daily scan limit reached (2/2)</p>
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
import { getTodayDateString } from '@/services/getTodayDateString'

export default {
  name: 'QRCodeScanner',
  components: {
    QrcodeStream
  },
  emits: ['attendance-marked'],
  data() {
    return {
      scanning: false,
      attendanceMarked: false,
      markTime: null,
      markDate: null,
      sessionType: '',
      error: null,
      todayScans: null,
      scanCount: 0
    }
  },
  mounted() {
    this.checkTodayScans()
  },
  methods: {
    async checkTodayScans() {
      if (!auth.currentUser) return

      const today = getTodayDateString()
      const userAttendanceRef = dbRef(db, `user-attendance/${auth.currentUser.uid}/${today}`)

      try {
        const snapshot = await get(userAttendanceRef)
        if (snapshot.exists()) {
          const data = snapshot.val()

          // Check if it's the new format (object with multiple records) or old format
          if (typeof data === 'object' && !Array.isArray(data) && data.timestamp === undefined) {
            // New format - it's an object with multiple records
            // Get all timestamps and sort them chronologically (earliest first)
            const timestamps = Object.keys(data)
              .map((key) => parseInt(key))
              .sort((a, b) => a - b)

            if (timestamps.length > 0) {
              this.todayScans = {
                firstScan: timestamps[0],
                secondScan: timestamps.length > 1 ? timestamps[1] : null
              }

              // Update scan count based on actual timestamps
              this.scanCount = Math.min(timestamps.length, 2)
            } else {
              this.todayScans = null
              this.scanCount = 0
            }
          } else {
            // Old format - single record
            this.todayScans = {
              firstScan: data.timestamp || null,
              secondScan: null
            }
            this.scanCount = data.timestamp ? 1 : 0
          }
        } else {
          this.todayScans = null
          this.scanCount = 0
        }
      } catch (error) {
        console.error("Error checking today's scans:", error)
      }
    },

    startScanning() {
      // Check if user has already reached scan limit
      if (this.scanCount >= 2) {
        this.error = 'You have already reached the daily scan limit (2 scans)'
        return
      }

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
      // Check if user is logged in
      if (!auth.currentUser) {
        this.error = 'You must be logged in to mark attendance'
        return
      }

      try {
        // Validate QR data
        if (!qrData || !qrData.sessionId) {
          this.error = 'Invalid QR code data'
          return
        }

        // Double-check that user is still logged in
        const user = auth.currentUser
        if (!user) {
          this.error = 'User authentication lost. Please log in again.'
          return
        }

        // Initialize user variables
        const userId = user.uid
        const userEmail = user.email

        // Check if session exists
        const sessionRef = dbRef(db, `attendance-sessions/${qrData.sessionId}`)
        const snapshot = await get(sessionRef)

        if (!snapshot.exists()) {
          this.error = 'Invalid attendance session'
          return
        }

        // Initialize session variables
        const today = getTodayDateString()
        const sessionData = snapshot.val()
        const sessionId = qrData.sessionId
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
          this.sessionType = 'Office'
        } else {
          this.sessionType = 'Custom Session'
        }

        // Check if user already has attendance records for today
        const userAttendanceRef = dbRef(db, `user-attendance/${userId}/${today}`)
        const userAttendanceSnapshot = await get(userAttendanceRef)

        // Create the new attendance record with careful validation
        const newAttendanceRecord = {
          timestamp: now,
          sessionId: sessionId,
          sessionType: sessionData.type || 'office',
          remote: false // This is office attendance
        }

        if (userAttendanceSnapshot.exists()) {
          const existingData = userAttendanceSnapshot.val()

          // Check if it's the new multi-record format
          if (
            typeof existingData === 'object' &&
            !Array.isArray(existingData) &&
            existingData.timestamp === undefined
          ) {
            // It's the new format - add a new record with the current timestamp
            console.log('Adding to existing multi-record format')
            await set(dbRef(db, `user-attendance/${userId}/${today}/${now}`), newAttendanceRecord)
          } else {
            // It's the old format - migrate to new format
            console.log('Migrating from old format to multi-record format')
            const oldTimestamp = existingData.timestamp || now - 1000 // Fallback if timestamp is missing

            // Create a new structure with both records
            const newStructure = {}
            newStructure[oldTimestamp] = {
              ...existingData,
              timestamp: oldTimestamp,
              sessionId: existingData.sessionId || 'unknown',
              sessionType: existingData.sessionType || 'unknown'
            }
            newStructure[now] = newAttendanceRecord

            // Replace the old record with the new structure
            await set(userAttendanceRef, newStructure)
          }
        } else {
          // No existing record - create a new one with the timestamp as the key
          console.log('Creating new attendance record')
          const newStructure = {}
          newStructure[now] = newAttendanceRecord

          await set(userAttendanceRef, newStructure)
        }

        // Update the session's attendees list
        const attendeeRef = dbRef(db, `attendance-sessions/${sessionId}/attendees/${userId}_${now}`)
        await set(attendeeRef, {
          email: userEmail,
          userId: userId,
          timestamp: now,
          remote: false
        })

        // Save to daily attendance records
        const dailyAttendanceRef = dbRef(db, `daily-attendance/${today}`)
        const newAttendanceRef = push(dailyAttendanceRef)

        await set(newAttendanceRef, {
          userId: userId,
          email: userEmail,
          timestamp: now,
          sessionId: sessionId,
          sessionType: sessionData.type || 'office',
          remote: false
        })

        // Update scan count and today's scans
        await this.checkTodayScans()

        // Set attendance marked to show success screen
        // After successful attendance marking
        this.attendanceMarked = true

        // Emit an event to the parent component
        this.$emit('attendance-marked')
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
      this.error = null

      // Emit event to refresh data when closing the success screen
      this.$emit('attendance-marked')
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
.qr-scanner {
  max-width: 500px;
  margin: 0 auto;
  background-color: #fff;
  border-radius: 8px;
}

.scan-status-display {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.success-status {
  margin-top: 20px;
  border-left: 4px solid #2196f3;
  background-color: #e3f2fd;
}

.scan-status-display h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  font-size: 1.1em;
}

.scan-details {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.scan-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.scan-row:last-child {
  border-bottom: none;
}

.scan-label {
  font-weight: bold;
  color: #333;
}

.scan-time {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scan-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.scan-badge.success {
  background-color: #e8f5e9;
  color: #388e3c;
}

.scan-badge.pending {
  background-color: #fff8e1;
  color: #ffa000;
}

.scan-limit-info {
  margin-top: 15px;
  text-align: center;
  font-size: 14px;
  color: #666;
}

.limit-reached {
  color: #f44336;
  font-weight: bold;
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

.limit-message {
  text-align: center;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  margin: 20px 0;
}

.limit-icon {
  font-size: 48px;
  color: #ff9800;
  margin-bottom: 10px;
  background-color: #fff3e0;
  width: 80px;
  height: 80px;
  line-height: 80px;
  border-radius: 50%;
  margin: 0 auto 20px;
}

.limit-note {
  margin-top: 15px;
  color: #ff9800;
  font-weight: bold;
}
</style>
