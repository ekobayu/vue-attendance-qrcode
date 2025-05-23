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
          <div class="location-input">
            <input type="text" id="location" v-model="location" placeholder="e.g. Home Office, Cafe, etc." />
            <!-- <button
              @click="getCurrentLocation"
              class="location-btn"
              :disabled="gettingLocation"
              :title="locationSupported ? 'Get current location' : 'Geolocation not supported'"
            >
              <span v-if="gettingLocation" class="loading-spinner"></span>
              <span v-else class="location-icon">📍</span>
            </button> -->
          </div>
          <small v-if="locationStatus" :class="['location-status', locationStatusType]">
            {{ locationStatus }}
          </small>

          <!-- Common locations dropdown -->
          <div class="common-locations">
            <label class="small-label">Quick select:</label>
            <div class="location-chips">
              <button
                v-for="(loc, index) in commonLocations"
                :key="index"
                @click="location = loc"
                class="location-chip"
                type="button"
              >
                {{ loc }}
              </button>
            </div>
          </div>
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
      error: null,
      gettingLocation: false,
      locationStatus: '',
      locationStatusType: 'info',
      locationSupported: 'geolocation' in navigator,
      commonLocations: ['Home', 'Coffee Shop', 'Co-working Space', 'Library', 'Client Site']
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
    getCurrentLocation() {
      if (!this.locationSupported) {
        this.locationStatus = 'Geolocation is not supported by your browser'
        this.locationStatusType = 'error'
        return
      }

      this.gettingLocation = true
      this.locationStatus = 'Getting your location...'
      this.locationStatusType = 'info'

      // Try IP-based geolocation as a fallback
      const tryIpBasedLocation = async () => {
        try {
          // Use a free IP geolocation API
          const response = await fetch('https://ipapi.co/json/')
          if (!response.ok) throw new Error('IP location service unavailable')

          const data = await response.json()
          if (data.error) throw new Error(data.reason || 'IP location failed')

          let locationText = ''

          if (data.city && data.country_name) {
            locationText = `${data.city}, ${data.region || ''} ${data.country_name}`
          } else if (data.country_name) {
            locationText = data.country_name
          } else {
            throw new Error('Location details not available')
          }

          this.location = locationText.trim()
          this.locationStatus = 'Location detected via IP address'
          this.locationStatusType = 'success'
        } catch (error) {
          console.error('IP geolocation error:', error)
          this.locationStatus = 'Could not detect your location automatically. Please enter it manually.'
          this.locationStatusType = 'error'
        } finally {
          this.gettingLocation = false
        }
      }

      // Try browser geolocation first
      navigator.geolocation.getCurrentPosition(
        // Success callback
        async (position) => {
          try {
            const { latitude, longitude } = position.coords

            // Get location name from coordinates using reverse geocoding
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'AttendanceApp/1.0' // Add a user agent to comply with Nominatim usage policy
                }
              }
            )

            if (!response.ok) {
              throw new Error('Failed to get location name')
            }

            const data = await response.json()

            // Format the location
            let locationName = ''

            if (data.address) {
              const address = data.address

              // Try to create a meaningful location name
              if (address.road) {
                locationName = address.road

                if (address.house_number) {
                  locationName = `${address.house_number} ${locationName}`
                }

                if (address.suburb || address.neighbourhood) {
                  locationName += `, ${address.suburb || address.neighbourhood}`
                }

                if (address.city || address.town || address.village) {
                  locationName += `, ${address.city || address.town || address.village}`
                }
              } else if (data.display_name) {
                // Fall back to display name if no road
                locationName = data.display_name
              }
            } else if (data.display_name) {
              locationName = data.display_name
            }

            // Set the location
            if (locationName) {
              this.location = locationName
              this.locationStatus = 'Location detected successfully'
              this.locationStatusType = 'success'
            } else {
              this.location = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
              this.locationStatus = 'Location coordinates detected'
              this.locationStatusType = 'success'
            }
          } catch (error) {
            console.error('Error getting location name:', error)

            // Try to use just the coordinates
            try {
              const { latitude, longitude } = position.coords
              this.location = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
              this.locationStatus = 'Location coordinates detected'
              this.locationStatusType = 'success'
            } catch (coordError) {
              console.error('Error using coordinates:', coordError)
              // Fall back to IP-based location
              await tryIpBasedLocation()
            }
          } finally {
            this.gettingLocation = false
          }
        },
        // Error callback
        async () => {
          // console.error('Geolocation error:', error)

          // Try IP-based geolocation as fallback
          await tryIpBasedLocation()
        },
        // Options
        {
          enableHighAccuracy: false, // Set to false to improve success rate
          timeout: 10000,
          maximumAge: 60000 // Allow cached positions up to 1 minute old
        }
      )
    },

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
            this.sessionType = 'Morning Session (07:30 AM - 04:30 PM)'
          } else if (data.sessionType === 'day') {
            this.sessionType = 'Day Session (08:00 AM - 05:00 PM)'
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
          this.submitting = false
          return
        }

        // Set current time and date
        this.markTime = Date.now()
        this.markDate = this.activeSession.date

        // Set session type
        if (this.activeSession.type === 'morning') {
          this.sessionType = 'Morning Session (07:30 AM - 04:30 PM)'
        } else if (this.activeSession.type === 'day') {
          this.sessionType = 'Day Session (08:00 AM - 05:00 PM)'
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
        return 'Morning Session (07:30 AM - 04:30 PM)'
      } else if (type === 'day') {
        return 'Day Session (08:00 AM - 05:00 PM)'
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

.location-input {
  display: flex;
  gap: 10px;
}

.location-input input {
  flex: 1;
}

.location-btn {
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  width: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.location-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.location-icon {
  font-size: 18px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.location-status {
  display: block;
  margin-top: 5px;
  font-size: 12px;
}

.location-status.success {
  color: #4caf50;
}

.location-status.error {
  color: #f44336;
}

.location-status.info {
  color: #2196f3;
}

.common-locations {
  margin-top: 10px;
}

.small-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
  display: block;
}

.location-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
}

.location-chip {
  background-color: #e0e0e0;
  border: none;
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.location-chip:hover {
  background-color: #d0d0d0;
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
