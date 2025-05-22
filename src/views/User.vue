<template>
  <div class="user">
    <h1>Employee Attendance</h1>

    <div v-if="!user">
      <p>Please log in to mark your attendance.</p>
      <router-link to="/" class="login-link">Go to Login</router-link>
    </div>

    <div v-else>
      <div class="user-info">
        <p>
          Logged in as: <strong>{{ user.email }}</strong>
        </p>
        <p>
          Today's Date: <strong>{{ currentDate }}</strong>
        </p>
      </div>

      <div class="attendance-options">
        <div class="option-card">
          <h3>In-Person Attendance</h3>
          <p>Scan the QR code displayed in your classroom or office.</p>
          <div class="attendance-card">
            <QRCodeScanner />
          </div>
        </div>

        <div class="option-card remote">
          <h3>Remote Work Attendance</h3>
          <p>Working from home or another location? Mark your attendance remotely.</p>
          <router-link to="/remote-attendance" class="remote-btn">Mark Remote Attendance</router-link>
        </div>
      </div>

      <div class="attendance-history">
        <h2>Your Recent Attendance</h2>
        <div v-if="loading" class="loading">Loading your attendance history...</div>
        <div v-else-if="attendanceHistory.length === 0" class="no-records">You haven't marked attendance yet.</div>
        <div v-else class="history-list">
          <div v-for="(record, index) in attendanceHistory" :key="index" class="history-item">
            <div class="date">{{ formatDateOnly(record.date) }}</div>
            <div class="record-details">
              <div class="timestamp">{{ formatTime(record.timestamp) }}</div>
              <div class="badge" :class="record.remote ? 'remote-badge' : 'in-person-badge'">
                {{ record.remote ? 'Remote' : 'In-Person' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { auth, db } from '../firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { ref as dbRef, get } from 'firebase/database'
import QRCodeScanner from '../components/QRCodeScanner.vue'

export default {
  name: 'UserPage',
  components: {
    QRCodeScanner
  },
  data() {
    return {
      user: null,
      attendanceHistory: [],
      loading: false,
      currentDate: new Date().toLocaleDateString()
    }
  },
  created() {
    onAuthStateChanged(auth, (user) => {
      this.user = user
      if (!user) {
        this.$router.push('/')
      } else {
        this.loadAttendanceHistory()
      }
    })
  },
  methods: {
    async loadAttendanceHistory() {
      if (!this.user) return

      this.loading = true
      try {
        const userAttendanceRef = dbRef(db, `user-attendance/${this.user.uid}`)
        const snapshot = await get(userAttendanceRef)

        if (snapshot.exists()) {
          const attendanceData = snapshot.val()
          const history = []

          // Convert object to array with date as a property
          for (const date in attendanceData) {
            history.push({
              date: date,
              timestamp: attendanceData[date].timestamp,
              remote: attendanceData[date].remote || false,
              location: attendanceData[date].location || ''
            })
          }

          // Sort by date (newest first)
          this.attendanceHistory = history.sort((a, b) => new Date(b.date) - new Date(a.date))
        } else {
          this.attendanceHistory = []
        }
      } catch (error) {
        console.error('Error loading attendance history:', error)
      } finally {
        this.loading = false
      }
    },

    formatDateOnly(dateString) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      return new Date(dateString).toLocaleDateString(undefined, options)
    },

    formatTime(timestamp) {
      const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' }
      return new Date(timestamp).toLocaleTimeString(undefined, options)
    }
  }
}
</script>

<style scoped>
.user {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
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

.attendance-options {
  display: flex;
  gap: 20px;
  margin: 30px 0;
}

.option-card {
  flex: 1;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.option-card h3 {
  margin-top: 0;
  color: #333;
  border-bottom: 2px solid #4caf50;
  padding-bottom: 10px;
}

.option-card.remote h3 {
  border-bottom-color: #2196f3;
}

.remote-btn {
  display: inline-block;
  background-color: #2196f3;
  color: white;
  padding: 10px 20px;
  text-decoration: none;
  border-radius: 4px;
  margin-top: 15px;
}

.attendance-history {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.loading {
  text-align: center;
  color: #666;
  padding: 20px;
}

.no-records {
  text-align: center;
  color: #666;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.history-list {
  margin-top: 15px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border-bottom: 1px solid #eee;
  align-items: center;
}

.history-item:last-child {
  border-bottom: none;
}

.date {
  font-weight: bold;
}

.record-details {
  display: flex;
  align-items: center;
  gap: 10px;
}

.timestamp {
  color: #666;
  font-size: 0.9em;
}

.badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.remote-badge {
  background-color: #e3f2fd;
  color: #1976d2;
}

.in-person-badge {
  background-color: #e8f5e9;
  color: #388e3c;
}

@media (max-width: 768px) {
  .attendance-options {
    flex-direction: column;
  }
}
</style>
