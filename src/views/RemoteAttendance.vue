<template>
  <div class="remote-attendance">
    <h2>Remote Work Attendance</h2>

    <div v-if="!user">
      <p>Please log in to mark your remote attendance.</p>
      <router-link to="/" class="login-link">Go to Login</router-link>
    </div>

    <div v-else-if="!attendanceMarked">
      <div class="user-info">
        <p>
          Logged in as: <strong>{{ user.email }}</strong>
        </p>
        <p>
          Today's Date: <strong>{{ currentDate }}</strong>
        </p>
      </div>

      <div v-if="activeSession" class="session-info">
        <h3>Active Attendance Session</h3>
        <p><strong>Date:</strong> {{ formatDate(activeSession.date) }}</p>
        <p><strong>Type:</strong> {{ getSessionTypeDisplay(activeSession.type) }}</p>
        <p><strong>Valid from:</strong> {{ formatTime(activeSession.startTime) }}</p>
        <p><strong>Valid until:</strong> {{ formatTime(activeSession.endTime) }}</p>
      </div>

      <div v-else class="no-session">
        <p>There is no active attendance session at this time.</p>
        <p>Please try again later or contact your administrator.</p>
      </div>

      <div v-if="activeSession" class="remote-form">
        <h3>Mark Remote Attendance</h3>

        <div class="form-group">
          <label for="location">Working From:</label>
          <input type="text" id="location" v-model="location" placeholder="e.g. Home Office, Cafe, etc." />
        </div>

        <div class="form-group">
          <label for="work-summary">Work Summary:</label>
          <textarea
            id="work-summary"
            v-model="workSummary"
            rows="3"
            placeholder="Brief summary of your work today"
          ></textarea>
        </div>

        <button @click="markRemoteAttendance" :disabled="!location || submitting" class="mark-btn">
          {{ submitting ? 'Submitting...' : 'Mark Attendance' }}
        </button>
      </div>
    </div>

    <div v-else class="success-container">
      <div class="success-icon">✓</div>
      <h3>Remote Attendance Marked Successfully!</h3>
      <p>Date: {{ formatDate(markDate) }}</p>
      <p>Time: {{ formatTime(markTime) }}</p>
      <p>Session: {{ sessionType }}</p>
      <p>Location: {{ location }}</p>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { auth, db } from '../firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { ref as dbRef, set, get, push, onValue } from 'firebase/database'

export default {
  name: 'RemoteAttendance',
  data() {
    return {
      user: null,
      currentDate: new Date().toLocaleDateString(),
      activeSession: null,
      location: '',
      workSummary: '',
      submitting: false,
      attendanceMarked: false,
      markTime: null,
      markDate: null,
      sessionType: '',
      error: null
    }
  },
  created() {
    onAuthStateChanged(auth, (user) => {
      this.user = user
      if (!user) {
        this.$router.push('/')
      } else {
        this.checkActiveSession()
        this.checkAttendanceStatus()
      }
    })
  },
  methods: {
    checkActiveSession() {
      // Check if there's a session ID in the URL
      const urlParams = new URLSearchParams(window.location.search)
      const sessionId = urlParams.get('session')

      if (sessionId) {
        // Load specific session
        this.loadSessionById(sessionId)
      } else {
        // Load active session
        this.loadActiveSession()
      }
    },

    async loadSessionById(sessionId) {
      try {
        const sessionRef = dbRef(db, `attendance-sessions/${sessionId}`)
        const snapshot = await get(sessionRef)

        if (snapshot.exists()) {
          const sessionData = snapshot.val()

          // Check if session is still valid
          const now = Date.now()
          if (now >= sessionData.startTime && now <= sessionData.endTime) {
            this.activeSession = {
              ...sessionData,
              sessionId: sessionId
            }
          } else {
            this.error = 'This attendance session is no longer active.'
          }
        } else {
          this.error = 'Invalid attendance session.'
        }
      } catch (error) {
        console.error('Error loading session:', error)
        this.error = 'Failed to load attendance session.'
      }
    },

    loadActiveSession() {
      const activeSessionRef = dbRef(db, 'active-session')
      onValue(activeSessionRef, (snapshot) => {
        if (snapshot.exists()) {
          this.activeSession = snapshot.val()
        } else {
          this.activeSession = null
        }
      })
    },

    async checkAttendanceStatus() {
      if (!this.user) return

      const today = new Date().toISOString().split('T')[0]
      const userAttendanceRef = dbRef(db, `user-attendance/${this.user.uid}/${today}`)

      onValue(userAttendanceRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val()
          this.attendanceMarked = true
          this.markTime = data.timestamp
          this.markDate = today
          this.location = data.location || ''

          // Get session type
          if (data.sessionType === 'morning') {
            this.sessionType = 'Morning Session (6 AM - 6 PM)'
          } else if (data.sessionType === 'day') {
            this.sessionType = 'Day Session (8 AM - 6 PM)'
          } else {
            this.sessionType = 'Custom Session'
          }
        }
      })
    },

    async markRemoteAttendance() {
      if (!this.activeSession) {
        this.error = 'No active session available'
        return
      }

      if (!this.location) {
        this.error = 'Please enter your working location'
        return
      }

      this.submitting = true
      this.error = null

      try {
        const sessionId = this.activeSession.sessionId
        const userId = this.user.uid
        const userEmail = this.user.email

        // Check if user already marked attendance for this session
        const attendeeRef = dbRef(db, `attendance-sessions/${sessionId}/attendees/${userId}`)
        const snapshot = await get(attendeeRef)

        if (snapshot.exists()) {
          this.error = 'You have already marked your attendance for this session'
          return
        }

        // Set current time and date
        this.markTime = Date.now()
        this.markDate = this.activeSession.date

        // Set session type
        if (this.activeSession.type === 'morning') {
          this.sessionType = 'Morning Session (6 AM - 6 PM)'
        } else if (this.activeSession.type === 'day') {
          this.sessionType = 'Day Session (8 AM - 6 PM)'
        } else {
          this.sessionType = 'Custom Session'
        }

        // Mark attendance in session with remote work flag
        await set(attendeeRef, {
          email: userEmail,
          timestamp: this.markTime,
          remote: true,
          location: this.location,
          workSummary: this.workSummary || ''
        })

        // Also save to daily attendance records
        const dailyAttendanceRef = dbRef(db, `daily-attendance/${this.activeSession.date}`)
        const newAttendanceRef = push(dailyAttendanceRef)
        await set(newAttendanceRef, {
          userId: userId,
          email: userEmail,
          timestamp: this.markTime,
          sessionId: sessionId,
          sessionType: this.activeSession.type,
          remote: true,
          location: this.location,
          workSummary: this.workSummary || ''
        })

        // Also save to user's attendance history
        const userAttendanceRef = dbRef(db, `user-attendance/${userId}/${this.activeSession.date}`)
        await set(userAttendanceRef, {
          timestamp: this.markTime,
          recordId: newAttendanceRef.key,
          sessionType: this.activeSession.type,
          remote: true,
          location: this.location
        })

        this.attendanceMarked = true
      } catch (error) {
        console.error('Error marking remote attendance:', error)
        this.error = 'Failed to mark attendance: ' + error.message
      } finally {
        this.submitting = false
      }
    },

    getSessionTypeDisplay(type) {
      if (type === 'morning') {
        return 'Morning Session (6 AM - 6 PM)'
      } else if (type === 'day') {
        return 'Day Session (8 AM - 6 PM)'
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
.remote-attendance {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.user-info {
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #4caf50;
  display: flex;
  justify-content: space-between;
}

.login-link {
  display: inline-block;
  background-color: #4caf50;
  color: white;
  padding: 10px 15px;
  text-decoration: none;
  border-radius: 4px;
  margin-top: 10px;
}

.session-info {
  background-color: #e3f2fd;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #2196f3;
}

.session-info h3 {
  margin-top: 0;
  color: #333;
}

.no-session {
  background-color: #fff3e0;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #ff9800;
  text-align: center;
}

.remote-form {
  margin-top: 20px;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

input,
textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

textarea {
  resize: vertical;
}

.mark-btn {
  background-color: #4caf50;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: block;
  width: 100%;
  margin-top: 20px;
}

.mark-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
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

.error-message {
  margin-top: 20px;
  padding: 10px 15px;
  background-color: #f2dede;
  color: #a94442;
  border-radius: 4px;
  text-align: center;
}
</style>
