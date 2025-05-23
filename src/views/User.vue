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

      <!-- Tabs Navigation -->
      <div class="tabs">
        <button @click="activeTab = 'mark'" :class="{ active: activeTab === 'mark' }" class="tab-btn">
          Mark Attendance
        </button>
        <button @click="activeTab = 'history'" :class="{ active: activeTab === 'history' }" class="tab-btn">
          Attendance History
        </button>
      </div>

      <!-- Mark Attendance Tab -->
      <div v-if="activeTab === 'mark'" class="tab-content">
        <div class="attendance-options">
          <div class="option-card">
            <h3>In-Person Attendance</h3>
            <p>Scan the QR code displayed in your office.</p>
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
            <div v-for="(record, index) in recentAttendance" :key="index" class="history-item">
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

      <!-- History Tab -->
      <div v-else-if="activeTab === 'history'" class="tab-content">
        <div class="history-controls">
          <div class="month-filter">
            <label for="month-select">Filter by Month:</label>
            <select id="month-select" v-model="selectedMonth" @change="filterAttendanceHistory">
              <option value="">All Months</option>
              <option v-for="month in availableMonths" :key="month.value" :value="month.value">
                {{ month.label }}
              </option>
            </select>
          </div>

          <div class="search-box">
            <input type="text" v-model="searchQuery" placeholder="Search..." @input="filterAttendanceHistory" />
            <button v-if="searchQuery" @click="clearSearch" class="clear-search">✕</button>
          </div>
        </div>

        <div class="attendance-stats">
          <div class="stat-card">
            <div class="stat-value">{{ filteredHistory.length }}</div>
            <div class="stat-label">Total Days</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ inPersonCount }}</div>
            <div class="stat-label">In-Person</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ remoteCount }}</div>
            <div class="stat-label">Remote</div>
          </div>
        </div>

        <div v-if="loading" class="loading">Loading your attendance history...</div>
        <div v-else-if="filteredHistory.length === 0" class="no-records">No attendance records found.</div>
        <div v-else>
          <!-- Group by month -->
          <div v-for="(group, month) in groupedHistory" :key="month" class="month-group">
            <div class="month-header" @click="toggleMonthExpand(month)">
              <div class="month-title">
                <span class="expand-icon">{{ expandedMonths[month] ? '▼' : '►' }}</span>
                <h3>{{ month }}</h3>
              </div>
              <span class="record-count">{{ group.length }} days</span>
            </div>

            <div v-if="expandedMonths[month]" class="month-records">
              <div v-for="(record, index) in group" :key="index" class="history-item detailed">
                <div class="date-info">
                  <div class="day-name">{{ getDayName(record.date) }}</div>
                  <div class="date">{{ formatDateShort(record.date) }}</div>
                </div>
                <div class="record-details">
                  <div class="timestamp">{{ formatTime(record.timestamp) }}</div>
                  <div class="session-type" v-if="record.sessionType">
                    {{ getSessionTypeDisplay(record.sessionType) }}
                  </div>
                  <div class="badge" :class="record.remote ? 'remote-badge' : 'in-person-badge'">
                    {{ record.remote ? 'Remote' : 'In-Person' }}
                  </div>
                  <div class="location" v-if="record.remote && record.location">
                    {{ record.location }}
                  </div>
                </div>
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
      filteredHistory: [],
      groupedHistory: {},
      loading: false,
      currentDate: new Date().toLocaleDateString(),
      activeTab: 'mark',
      selectedMonth: '',
      searchQuery: '',
      expandedMonths: {}
    }
  },
  computed: {
    recentAttendance() {
      // Show only the 5 most recent attendance records
      return this.attendanceHistory.slice(0, 5)
    },

    availableMonths() {
      const months = new Set()

      this.attendanceHistory.forEach((record) => {
        const date = new Date(record.date)
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' })
        const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

        months.add(JSON.stringify({ label: monthYear, value: monthValue }))
      })

      return Array.from(months)
        .map((month) => JSON.parse(month))
        .sort((a, b) => b.value.localeCompare(a.value)) // Sort newest first
    },

    inPersonCount() {
      return this.filteredHistory.filter((record) => !record.remote).length
    },

    remoteCount() {
      return this.filteredHistory.filter((record) => record.remote).length
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
              location: attendanceData[date].location || '',
              sessionType: attendanceData[date].sessionType || ''
            })
          }

          // Sort by date (newest first)
          this.attendanceHistory = history.sort((a, b) => new Date(b.date) - new Date(a.date))
          this.filterAttendanceHistory()
        } else {
          this.attendanceHistory = []
          this.filteredHistory = []
          this.groupedHistory = {}
        }
      } catch (error) {
        console.error('Error loading attendance history:', error)
      } finally {
        this.loading = false
      }
    },

    filterAttendanceHistory() {
      let filtered = [...this.attendanceHistory]

      // Filter by month if selected
      if (this.selectedMonth) {
        filtered = filtered.filter((record) => {
          const date = new Date(record.date)
          const recordMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          return recordMonth === this.selectedMonth
        })
      }

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        filtered = filtered.filter((record) => {
          return (
            this.formatDateOnly(record.date).toLowerCase().includes(query) ||
            (record.location && record.location.toLowerCase().includes(query)) ||
            (record.sessionType && this.getSessionTypeDisplay(record.sessionType).toLowerCase().includes(query))
          )
        })
      }

      this.filteredHistory = filtered
      this.groupHistoryByMonth()
    },

    groupHistoryByMonth() {
      const grouped = {}

      this.filteredHistory.forEach((record) => {
        const date = new Date(record.date)
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' })

        if (!grouped[monthYear]) {
          grouped[monthYear] = []

          // Auto-expand if it's the only month or if filtering
          if (!this.expandedMonths[monthYear]) {
            this.expandedMonths = {
              ...this.expandedMonths,
              [monthYear]: true
            }
          }
        }

        grouped[monthYear].push(record)
      })

      // Sort records within each month by date (newest first)
      Object.keys(grouped).forEach((month) => {
        grouped[month].sort((a, b) => new Date(b.date) - new Date(a.date))
      })

      this.groupedHistory = grouped
    },

    toggleMonthExpand(month) {
      this.expandedMonths = {
        ...this.expandedMonths,
        [month]: !this.expandedMonths[month]
      }
    },

    clearSearch() {
      this.searchQuery = ''
      this.filterAttendanceHistory()
    },

    formatDateOnly(dateString) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      return new Date(dateString).toLocaleDateString(undefined, options)
    },

    formatDateShort(dateString) {
      const options = { day: 'numeric', month: 'short' }
      return new Date(dateString).toLocaleDateString(undefined, options)
    },

    getDayName(dateString) {
      const options = { weekday: 'short' }
      return new Date(dateString).toLocaleDateString(undefined, options)
    },

    formatTime(timestamp) {
      const options = { hour: '2-digit', minute: '2-digit', hour12: true }
      return new Date(timestamp).toLocaleTimeString(undefined, options)
    },

    getSessionTypeDisplay(type) {
      if (type === 'morning') {
        return 'Morning Session'
      } else if (type === 'day') {
        return 'Day Session'
      } else if (type === 'full-day') {
        return 'Full Day'
      } else if (type === 'custom') {
        return 'Custom Session'
      }
      return type || ''
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

/* Tab styles */
.tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
}

.tab-btn.active {
  color: #4caf50;
  border-bottom-color: #4caf50;
}

.tab-content {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* History tab styles */
.history-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.month-filter {
  flex: 1;
  min-width: 200px;
}

.month-filter label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.month-filter select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-box input {
  width: 100%;
  padding: 10px;
  padding-right: 30px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.clear-search {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
}

.attendance-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  color: #666;
  font-size: 14px;
  margin-top: 5px;
}

.month-group {
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.month-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: #f5f5f5;
  cursor: pointer;
  transition: background-color 0.2s;
}

.month-header:hover {
  background-color: #e8e8e8;
}

.month-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expand-icon {
  color: #666;
  font-size: 12px;
  width: 12px;
}

.month-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1em;
}

.record-count {
  background-color: #e0e0e0;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.9em;
  color: #555;
}

.month-records {
  padding: 10px;
  background-color: #fff;
  animation: fadeIn 0.3s ease-in-out;
}

.history-item.detailed {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border-bottom: 1px solid #eee;
  align-items: center;
}

.history-item.detailed:last-child {
  border-bottom: none;
}

.date-info {
  display: flex;
  flex-direction: column;
}

.day-name {
  font-weight: bold;
  color: #333;
}

.date {
  color: #666;
}

.record-details {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.session-type {
  color: #555;
  font-style: italic;
}

.location {
  color: #666;
  font-size: 0.9em;
}

@media (max-width: 768px) {
  .attendance-stats {
    flex-direction: column;
    gap: 10px;
  }

  .history-item.detailed {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .record-details {
    width: 100%;
  }
}
</style>
