<template>
  <div class="admin">
    <h1>Admin Panel</h1>

    <div v-if="!isAdmin">
      <p>You don't have permission to access this page.</p>
      <router-link to="/">Return to Home</router-link>
    </div>

    <div v-else>
      <div class="tabs">
        <button @click="activeTab = 'qrcode'" :class="{ active: activeTab === 'qrcode' }">Attendance QR Code</button>
        <button @click="activeTab = 'records'" :class="{ active: activeTab === 'records' }">Attendance Records</button>
        <button @click="activeTab = 'users'" :class="{ active: activeTab === 'users' }">User Management</button>
        <button @click="activeTab = 'remote'" :class="{ active: activeTab === 'remote' }">Remote Settings</button>
        <button @click="activeTab = 'settings'" :class="{ active: activeTab === 'settings' }">Time Settings</button>
      </div>

      <div class="admin-dashboard" v-if="activeTab === 'qrcode'">
        <div class="stats-card">
          <h3>Today's Attendance</h3>
          <div class="stat-value">{{ todayAttendanceCount }}</div>
          <div class="stat-label">People</div>
        </div>

        <div class="stats-card">
          <h3>Total Users</h3>
          <div class="stat-value">{{ userCount }}</div>
          <div class="stat-label">Registered</div>
        </div>
      </div>

      <div class="tab-content">
        <QRCodeGenerator v-if="activeTab === 'qrcode'" />
        <AttendanceList v-if="activeTab === 'records'" />
        <UserManagement v-if="activeTab === 'users'" />
        <RemoteWorkSettings v-if="activeTab === 'remote'" />
        <AutoResetSettings v-if="activeTab === 'settings'" />
      </div>
    </div>
  </div>
</template>

<script>
import { auth, db } from '../firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { ref as dbRef, get, onValue, set, remove } from 'firebase/database'
import QRCodeGenerator from '../components/QRCodeGenerator.vue'
import AttendanceList from '../components/AttendanceList.vue'
import UserManagement from '../components/UserManagement.vue'
import AutoResetSettings from '../components/AutoResetSettings.vue'
import RemoteWorkSettings from '../components/RemoteWorkSettings.vue'
import { getTodayDateString } from '@/services/getTodayDateString'

export default {
  name: 'AdminPage',
  components: {
    QRCodeGenerator,
    AttendanceList,
    UserManagement,
    AutoResetSettings,
    RemoteWorkSettings
  },
  data() {
    return {
      isAdmin: false,
      activeTab: 'qrcode',
      todayAttendanceCount: 0,
      userCount: 0
    }
  },
  created() {
    this.checkAdminStatus()
  },
  mounted() {
    this.checkAdminStatus()
    this.checkForNeededReset()
  },
  methods: {
    async checkForNeededReset() {
      try {
        const resetFlagRef = dbRef(db, 'reset-needed')
        const snapshot = await get(resetFlagRef)

        if (snapshot.exists()) {
          const resetData = snapshot.val()

          // Check if the reset flag is recent (within last hour)
          if (Date.now() - resetData.timestamp < 60 * 60 * 1000) {
            // console.log('Reset needed flag found, checking active session...')

            // Get active session
            const activeSessionRef = dbRef(db, 'active-session')
            const sessionSnapshot = await get(activeSessionRef)

            if (sessionSnapshot.exists()) {
              const activeSession = sessionSnapshot.val()

              // Check if it's time to reset
              if (activeSession.autoReset && activeSession.nextResetTime && Date.now() >= activeSession.nextResetTime) {
                // console.log('Performing needed auto-reset...')
                await this.performAutoReset(activeSession)
              }
            }

            // Clear the reset flag
            await remove(resetFlagRef)
          }
        }
      } catch (error) {
        console.error('Error checking for needed reset:', error)
      }
    },

    // Add this method to perform the reset
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

        // console.log('QR code auto-reset complete')
      } catch (error) {
        console.error('Error during auto-reset:', error)
      }
    },
    checkAdminStatus() {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const userRef = dbRef(db, `users/${user.uid}`)
          const snapshot = await get(userRef)

          if (snapshot.exists()) {
            const userData = snapshot.val()
            this.isAdmin = userData && userData.isAdmin === true

            if (this.isAdmin) {
              this.loadStats()
            } else {
              this.$router.push('/')
            }
          } else {
            this.isAdmin = false
            this.$router.push('/')
          }
        } else {
          this.isAdmin = false
          this.$router.push('/')
        }
      })
    },

    loadStats() {
      // Get today's date in YYYY-MM-DD format
      const today = getTodayDateString()

      // Get today's attendance count
      const todayAttendanceRef = dbRef(db, `daily-attendance/${today}`)
      onValue(todayAttendanceRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          // Count unique users instead of total records
          const uniqueUserIds = new Set()

          // Loop through all attendance records
          Object.values(data).forEach((record) => {
            if (record.userId) {
              uniqueUserIds.add(record.userId)
            }
          })

          // Set the count to the number of unique users
          this.todayAttendanceCount = uniqueUserIds.size
        } else {
          this.todayAttendanceCount = 0
        }
      })

      // Get user count
      const usersRef = dbRef(db, 'users')
      onValue(usersRef, (snapshot) => {
        const data = snapshot.val()
        this.userCount = data ? Object.keys(data).length : 0
      })
    }
  }
}
</script>

<style scoped>
.admin {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

.tabs button {
  padding: 10px 20px;
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  border-bottom: 3px solid transparent;
}

.tabs button.active {
  border-bottom-color: #4caf50;
  font-weight: bold;
}

.admin-dashboard {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
}

.stats-card {
  flex: 1;
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.stats-card h3 {
  margin-top: 0;
  color: #555;
  font-size: 16px;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: #4caf50;
  margin: 10px 0;
}

.stat-label {
  color: #777;
  font-size: 14px;
}

.tab-content {
  margin-top: 20px;
}

@media (max-width: 600px) {
  .admin-dashboard {
    flex-direction: column;
  }
}
</style>
