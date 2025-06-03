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

      <div class="scan-status">
        <h3>Today's Attendance Status</h3>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else>
          <div class="status-card">
            <div class="scan-item">
              <div class="scan-label">First Scan:</div>
              <div v-if="todayAttendance && todayAttendance.firstScan" class="scan-time">
                {{ formatTime(todayAttendance.firstScan) }}
                <span class="scan-badge success">Recorded</span>
              </div>
              <div v-else class="scan-time">
                Not recorded
                <span class="scan-badge pending">Pending</span>
              </div>
            </div>

            <div class="scan-item">
              <div class="scan-label">Second Scan:</div>
              <div v-if="todayAttendance && todayAttendance.secondScan" class="scan-time">
                {{ formatTime(todayAttendance.secondScan) }}
                <span class="scan-badge success">Recorded</span>
              </div>
              <div v-else class="scan-time">
                Not recorded
                <span class="scan-badge pending">Pending</span>
              </div>
            </div>

            <div class="scan-limit-info">
              <span v-if="scanCount >= 2" class="limit-reached">Daily scan limit reached</span>
              <span v-else>{{ 2 - scanCount }} scans remaining today</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="tabs">
        <button @click="switchTab('mark')" :class="{ active: activeTab === 'mark' }" class="tab-btn">
          Mark Attendance
        </button>
        <button @click="switchTab('history')" :class="{ active: activeTab === 'history' }" class="tab-btn">
          Attendance History
        </button>
      </div>

      <!-- Mark Attendance Tab -->
      <div v-if="activeTab === 'mark'" class="tab-content">
        <div class="attendance-options">
          <!-- Office Attendance Card -->
          <div class="option-card" :class="{ disabled: scanCount >= 2 }">
            <h3>Office Attendance</h3>
            <p>Scan the attendance QR code displayed in office to mark your attendance.</p>
            <div class="attendance-card" v-if="scanCount < 2">
              <QRCodeScanner />
            </div>
            <div class="limit-message" v-else>
              <p>You have reached your daily scan limit (2 scans).</p>
              <p>You can mark attendance again tomorrow.</p>
            </div>
          </div>

          <!-- Remote Work Attendance Card -->
          <div class="option-card remote" v-if="isRemoteWorkEnabled && scanCount < 2">
            <h3>Remote Work Attendance</h3>
            <p>Working from home or another location? Mark your attendance remotely.</p>
            <router-link to="/remote-attendance" class="remote-btn">Mark Remote Attendance</router-link>
          </div>

          <div class="option-card remote disabled" v-else>
            <h3>Remote Work Attendance</h3>
            <p>Remote work attendance is not available {{ getRemoteWorkUnavailableReason() }}</p>
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
                  {{ record.remote ? 'Remote' : 'Office' }}
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

          <!-- <div class="search-box">
            <input type="text" v-model="searchQuery" placeholder="Search..." @input="filterAttendanceHistory" />
            <button v-if="searchQuery" @click="clearSearch" class="clear-search">✕</button>
          </div> -->
        </div>

        <!-- Charts Section -->
        <div class="charts-section" v-if="!loading && attendanceHistory.length > 1">
          <h3>Attendance Analytics</h3>

          <div class="chart-controls">
            <button
              v-for="chartType in chartTypes"
              :key="chartType.value"
              @click="activeChartType = chartType.value"
              :class="['chart-btn', { active: activeChartType === chartType.value }]"
            >
              {{ chartType.label }}
            </button>
          </div>

          <attendance-chart
            :attendance-data="filteredHistory.length > 0 ? filteredHistory : attendanceHistory"
            :chart-type="activeChartType"
            :key="`chart-${activeChartType}-${filteredHistory.length}`"
          />
        </div>

        <div class="charts-section" v-else-if="!loading && attendanceHistory.length === 1">
          <div class="not-enough-data">
            <p>You need at least two days of attendance data to view analytics.</p>
          </div>
        </div>

        <div class="attendance-stats">
          <div class="stat-card">
            <div class="stat-value">{{ filteredHistory.length }}</div>
            <div class="stat-label">Total Days</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ inPersonCount }}</div>
            <div class="stat-label">Office</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ remoteCount }}</div>
            <div class="stat-label">Remote</div>
          </div>
          <div class="stat-card" @click="activeChartType = 'streak'" v-if="attendanceHistory.length > 0">
            <div class="stat-value">{{ currentStreak }}</div>
            <div class="stat-label">
              {{ hasMarkedAttendanceToday() ? 'Day Streak' : 'Previous Streak' }}
              <span v-if="!hasMarkedAttendanceToday()" class="streak-note">Mark today to continue!</span>
            </div>
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
                  <div class="scan-times">
                    <div class="scan-time" v-if="record.firstScan">
                      <span class="scan-label">In:</span>
                      {{ formatTime(record.firstScan) }}
                      <span
                        v-if="record.firstScanDetails && record.badgeType === 'mixed'"
                        class="mini-badge"
                        :class="record.firstScanDetails.remote ? 'remote-mini' : 'office-mini'"
                      >
                        {{ record.firstScanDetails.remote ? 'Remote' : 'Office' }}
                      </span>
                    </div>
                    <div class="scan-time" v-if="record.secondScan">
                      <span class="scan-label">Out:</span>
                      {{ formatTime(record.secondScan) }}
                      <span
                        v-if="record.secondScanDetails && record.badgeType === 'mixed'"
                        class="mini-badge"
                        :class="record.secondScanDetails.remote ? 'remote-mini' : 'office-mini'"
                      >
                        {{ record.secondScanDetails.remote ? 'Remote' : 'Office' }}
                      </span>
                    </div>
                  </div>

                  <!-- Update the badge to handle mixed type -->
                  <div class="badge" :class="getBadgeClass(record)">
                    {{ getBadgeText(record) }}
                  </div>

                  <div class="location" v-if="(record.remote || record.badgeType === 'mixed') && record.location">
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
import AttendanceChart from '../components/AttendanceChart.vue'
import { getTodayDateString } from '@/services/getTodayDateString'

export default {
  name: 'UserPage',
  components: {
    QRCodeScanner,
    AttendanceChart
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
      expandedMonths: {},
      remoteWorkSettings: null,
      remoteWorkLoaded: false,
      weeklyLimitReached: false,
      activeChartType: 'monthly',
      chartTypes: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Distribution', value: 'distribution' },
        { label: 'Streak', value: 'streak' }
      ],
      todayAttendance: null,
      scanCount: 0
      // currentStreak: 0
    }
  },
  mounted() {
    this.loadTodayAttendance()
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

    isRemoteWorkEnabled() {
      if (!this.remoteWorkLoaded || !this.remoteWorkSettings) return false

      // Check if user-specific permissions are enabled and if this user has permission
      if (
        this.remoteWorkSettings.enableUserSpecificPermissions &&
        this.remoteWorkSettings.allowedRemoteUsers &&
        this.remoteWorkSettings.allowedRemoteUsers[this.user.uid]
      ) {
        // User has specific permission to work remotely regardless of other restrictions
        return true
      }

      // Check if daily scan limit is reached
      if (this.scanCount >= 2) {
        return false // Daily scan limit reached, disable remote work
      }

      // Get current day and time
      const now = new Date()
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const currentDay = dayNames[now.getDay()]

      // Check if current day is enabled
      if (!this.remoteWorkSettings.enabledDays[currentDay]) {
        return false
      }

      // Check time restrictions
      if (this.remoteWorkSettings.startTime && this.remoteWorkSettings.endTime) {
        const currentTime = now.getHours() * 60 + now.getMinutes() // minutes since midnight

        const [startHours, startMinutes] = this.remoteWorkSettings.startTime.split(':').map(Number)
        const [endHours, endMinutes] = this.remoteWorkSettings.endTime.split(':').map(Number)

        const startTime = startHours * 60 + startMinutes
        const endTime = endHours * 60 + endMinutes

        if (currentTime < startTime || currentTime > endTime) {
          return false
        }
      }

      // Check weekly limit if enabled
      if (this.remoteWorkSettings.limitPerWeek && this.weeklyLimitReached) {
        return false
      }

      return true
    },

    inPersonCount() {
      return this.filteredHistory.filter((record) => !record.remote).length
    },

    remoteCount() {
      return this.filteredHistory.filter((record) => record.remote).length
    },

    currentStreak() {
      if (!this.attendanceHistory.length) return 0

      // Sort records by date in descending order (newest first)
      const sortedRecords = [...this.attendanceHistory].sort((a, b) => new Date(b.date) - new Date(a.date))

      // Get today's date without time
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Get yesterday's date
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      // Check if the most recent record is from today or yesterday
      const mostRecentDate = new Date(sortedRecords[0].date)
      mostRecentDate.setHours(0, 0, 0, 0)

      // If the most recent record is not from today or yesterday, no current streak
      if (mostRecentDate.getTime() !== today.getTime() && mostRecentDate.getTime() !== yesterday.getTime()) {
        return 0
      }

      // Start counting streak
      let streak = 1
      let expectedDate = new Date(mostRecentDate)

      // If most recent is yesterday, start checking from 2 days ago
      // If most recent is today, start checking from yesterday
      expectedDate.setDate(expectedDate.getDate() - 1)

      // Check consecutive days
      for (let i = 1; i < sortedRecords.length; i++) {
        const currentDate = new Date(sortedRecords[i].date)
        currentDate.setHours(0, 0, 0, 0)

        if (currentDate.getTime() === expectedDate.getTime()) {
          streak++
          expectedDate.setDate(expectedDate.getDate() - 1)
        } else {
          break // Break the streak if not consecutive
        }
      }

      return streak
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

    this.loadRemoteWorkSettings()
  },
  methods: {
    getBadgeClass(record) {
      if (record.badgeType === 'mixed') {
        return 'mixed-badge'
      } else if (record.remote) {
        return 'remote-badge'
      } else {
        return 'in-person-badge'
      }
    },

    getBadgeText(record) {
      if (record.badgeType === 'mixed') {
        return 'Mixed'
      } else if (record.remote) {
        return 'Remote'
      } else {
        return 'Office'
      }
    },
    switchTab(tabName) {
      // If switching to history tab, refresh the data
      if (tabName === 'history' && this.activeTab !== 'history') {
        this.loadAttendanceHistory(true) // Pass true to indicate it's a refresh
      }

      // Set the active tab
      this.activeTab = tabName
    },

    async loadTodayAttendance() {
      this.loading = true
      try {
        const user = auth.currentUser
        if (!user) return

        const today = getTodayDateString()
        const attendanceRef = dbRef(db, `user-attendance/${user.uid}/${today}`)
        const snapshot = await get(attendanceRef)

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
              this.todayAttendance = {
                firstScan: timestamps[0],
                secondScan: timestamps.length > 1 ? timestamps[1] : null
              }

              // Update scan count based on actual timestamps
              this.scanCount = Math.min(timestamps.length, 2)
            } else {
              this.todayAttendance = null
              this.scanCount = 0
            }
          } else {
            // Old format - single record
            this.todayAttendance = {
              firstScan: data.timestamp || null,
              secondScan: null
            }
            this.scanCount = data.timestamp ? 1 : 0
          }
        } else {
          this.todayAttendance = null
          this.scanCount = 0
        }
      } catch (error) {
        console.error("Error loading today's attendance:", error)
        this.todayAttendance = null
        this.scanCount = 0
      } finally {
        this.loading = false
      }
    },

    async loadAttendanceHistory(isRefresh = false) {
      if (!this.user) return

      // Only show loading indicator if it's not a refresh or if explicitly needed
      if (!isRefresh) {
        this.loading = true
      } else {
        // For refreshes, we can use a less intrusive loading state
        this.refreshing = true
      }

      try {
        const userAttendanceRef = dbRef(db, `user-attendance/${this.user.uid}`)
        const snapshot = await get(userAttendanceRef)

        if (snapshot.exists()) {
          const attendanceData = snapshot.val()
          const history = []

          // Convert object to array with date as a property
          for (const date in attendanceData) {
            const dateData = attendanceData[date]

            // Check if it's the new format (object with multiple records) or old format
            if (typeof dateData === 'object' && !Array.isArray(dateData) && dateData.timestamp === undefined) {
              // New format - it's an object with multiple records
              // Get all timestamps for this date
              const timestamps = Object.keys(dateData)
                .map(Number)
                .sort((a, b) => a - b)

              if (timestamps.length > 0) {
                // Get first scan (check-in)
                const firstScanTime = timestamps[0]
                const firstScan = dateData[firstScanTime]

                // Get second scan (check-out) if available
                const secondScanTime = timestamps.length > 1 ? timestamps[1] : null
                const secondScan = secondScanTime ? dateData[secondScanTime] : null

                // Determine if the day was remote, office, or mixed
                let isRemote = false
                let location = ''
                let badgeType = ''

                if (firstScan.remote && (!secondScan || secondScan.remote)) {
                  // Both scans are remote or only first scan exists and is remote
                  isRemote = true
                  location = firstScan.location || ''
                  badgeType = 'remote'
                } else if (!firstScan.remote && secondScan && !secondScan.remote) {
                  // Both scans are office
                  isRemote = false
                  location = 'Office'
                  badgeType = 'office'
                } else if (firstScan && secondScan) {
                  // Mixed: one scan is remote, one is office
                  badgeType = 'mixed'

                  // For mixed, prioritize showing remote location
                  if (firstScan.remote) {
                    location = firstScan.location || ''
                  } else if (secondScan.remote) {
                    location = secondScan.location || ''
                  }
                }

                history.push({
                  date: date,
                  timestamp: firstScanTime, // Use first scan time as primary timestamp
                  remote: isRemote,
                  location: location,
                  sessionType: firstScan.sessionType || '',
                  firstScan: firstScanTime,
                  secondScan: secondScanTime,
                  badgeType: badgeType, // Add badge type for display
                  // Store both scan details for reference
                  firstScanDetails: firstScan,
                  secondScanDetails: secondScan
                })
              }
            } else {
              // Old format - single record
              history.push({
                date: date,
                timestamp: dateData.timestamp,
                remote: dateData.remote || false,
                location: dateData.remote ? dateData.location || '' : 'Office',
                sessionType: dateData.sessionType || '',
                firstScan: dateData.timestamp,
                secondScan: null,
                badgeType: dateData.remote ? 'remote' : 'office'
              })
            }
          }

          // Sort by date (newest first)
          this.attendanceHistory = history.sort((a, b) => new Date(b.date) - new Date(a.date))
          this.filterAttendanceHistory()

          // If it's a refresh, show a toast notification
          if (isRefresh && this.$toast) {
            this.$toast.success('Attendance data refreshed')
          }
        } else {
          this.attendanceHistory = []
          this.filteredHistory = []
          this.groupedHistory = {}
        }
      } catch (error) {
        console.error('Error loading attendance history:', error)
        if (isRefresh && this.$toast) {
          this.$toast.error('Failed to refresh attendance data')
        }
      } finally {
        this.loading = false
        this.refreshing = false
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

    async loadRemoteWorkSettings() {
      try {
        const settingsRef = dbRef(db, 'settings/remoteWork')
        const snapshot = await get(settingsRef)

        if (snapshot.exists()) {
          this.remoteWorkSettings = snapshot.val()
        } else {
          // Default settings if none exist
          this.remoteWorkSettings = {
            enabledDays: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: false,
              sunday: false
            },
            startTime: '08:00',
            endTime: '17:00',
            requireLocation: true,
            limitPerWeek: false,
            maxDaysPerWeek: 3
          }
        }

        this.remoteWorkLoaded = true

        // If weekly limits are enabled, check user's remote days this week
        if (this.remoteWorkSettings?.limitPerWeek && this.user) {
          await this.checkWeeklyRemoteDays()
        }
      } catch (error) {
        console.error('Error loading remote work settings:', error)
        // Set default values on error
        this.remoteWorkSettings = {
          enabledDays: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false
          }
        }
        this.remoteWorkLoaded = true
      }
    },

    getRemoteWorkUnavailableReason() {
      if (!this.remoteWorkLoaded || !this.remoteWorkSettings) return 'while settings are loading...'

      // Check if daily scan limit is reached
      if (this.scanCount >= 2) {
        return 'as you have reached your daily scan limit (2 scans).'
      }

      // If user-specific permissions are enabled, check if this user is not in the allowed list
      if (
        this.remoteWorkSettings.enableUserSpecificPermissions &&
        this.remoteWorkSettings.allowedRemoteUsers &&
        !this.remoteWorkSettings.allowedRemoteUsers[this.user.uid]
      ) {
        return 'as you do not have permission for remote work.'
      }

      const now = new Date()
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const currentDay = dayNames[now.getDay()]

      // Check if current day is disabled
      if (!this.remoteWorkSettings.enabledDays[currentDay]) {
        return 'on ' + currentDay.charAt(0).toUpperCase() + currentDay.slice(1) + 's.'
      }

      // Check time restrictions
      if (this.remoteWorkSettings.startTime && this.remoteWorkSettings.endTime) {
        const [startHours, startMinutes] = this.remoteWorkSettings.startTime.split(':').map(Number)
        const [endHours, endMinutes] = this.remoteWorkSettings.endTime.split(':').map(Number)

        const startTimeFormatted = new Date().setHours(startHours, startMinutes, 0, 0)
        const endTimeFormatted = new Date().setHours(endHours, endMinutes, 0, 0)

        const startTimeDisplay = new Date(startTimeFormatted).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
        const endTimeDisplay = new Date(endTimeFormatted).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })

        const currentTime = now.getHours() * 60 + now.getMinutes()
        const startTime = startHours * 60 + startMinutes
        const endTime = endHours * 60 + endMinutes

        if (currentTime < startTime || currentTime > endTime) {
          return `outside allowed hours (${startTimeDisplay} - ${endTimeDisplay}).`
        }
      }

      // If weekly limit is reached
      if (this.remoteWorkSettings.limitPerWeek && this.weeklyLimitReached) {
        return `as you've reached your limit of ${this.remoteWorkSettings.maxDaysPerWeek} remote days this week.`
      }

      return 'at this time.'
    },

    async checkWeeklyRemoteDays() {
      if (!this.user) return

      try {
        // Get the start of the current week (Sunday)
        const today = new Date()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay()) // Go to Sunday
        startOfWeek.setHours(0, 0, 0, 0)

        // Get the end of the week (Saturday)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        endOfWeek.setHours(23, 59, 59, 999)

        // Format dates for query
        const startDate = startOfWeek.toISOString().split('T')[0]
        const endDate = endOfWeek.toISOString().split('T')[0]

        // Get user's attendance for this week
        const userAttendanceRef = dbRef(db, `user-attendance/${this.user.uid}`)
        const snapshot = await get(userAttendanceRef)

        if (snapshot.exists()) {
          const attendanceData = snapshot.val()
          let remoteDaysThisWeek = 0

          // Count remote days this week
          for (const date in attendanceData) {
            if (date >= startDate && date <= endDate && attendanceData[date].remote) {
              remoteDaysThisWeek++
            }
          }

          // Check if limit is reached
          this.weeklyLimitReached = remoteDaysThisWeek >= this.remoteWorkSettings.maxDaysPerWeek
        } else {
          this.weeklyLimitReached = false
        }
      } catch (error) {
        console.error('Error checking weekly remote days:', error)
        this.weeklyLimitReached = false
      }
    },

    toggleMonthExpand(month) {
      this.expandedMonths = {
        ...this.expandedMonths,
        [month]: !this.expandedMonths[month]
      }
    },

    hasMarkedAttendanceToday() {
      if (!this.attendanceHistory.length) return false

      const today = getTodayDateString() // YYYY-MM-DD format
      return this.attendanceHistory.some((record) => record.date === today)
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
      if (type === 'office') {
        return 'Office'
      } else if (type === 'morning') {
        return 'Morning'
      } else if (type === 'custom') {
        return 'Custom Session'
      }
      return type || 'Unknown'
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

.option-card.remote.disabled {
  opacity: 0.7;
  background-color: #f5f5f5;
}

.option-card.remote.disabled h3 {
  color: #666;
}

.option-card.remote.disabled p {
  color: #888;
}

.remote-btn {
  display: block;
  background-color: #2196f3;
  color: white;
  padding: 10px 20px;
  text-decoration: none;
  border-radius: 4px;
  text-align: center;
  margin: 20px auto;
  max-width: 200px;
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

/* Enhanced History Item Styling */
.history-list {
  margin-top: 15px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
  transition: background-color 0.2s ease;
}

.history-item:hover {
  background-color: #f9f9f9;
}

.history-item:last-child {
  border-bottom: none;
}

.history-item .date {
  font-weight: 600;
  color: #333;
  font-size: 15px;
}

.record-details {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timestamp {
  color: #666;
  font-size: 0.9em;
  background-color: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.remote-badge {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid rgba(25, 118, 210, 0.2);
}

.remote-badge::before {
  content: '🏠';
  margin-right: 5px;
  font-size: 12px;
}

.in-person-badge {
  background-color: #e8f5e9;
  color: #388e3c;
  border: 1px solid rgba(56, 142, 60, 0.2);
}

.in-person-badge::before {
  content: '🏢';
  margin-right: 5px;
  font-size: 12px;
}

/* Detailed history items in the monthly view */
.history-item.detailed {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.history-item.detailed:hover {
  background-color: #f9f9f9;
  border-left-color: #4caf50;
}

.history-item.detailed:last-child {
  border-bottom: none;
}

.date-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.day-name {
  font-weight: 700;
  color: #333;
  font-size: 16px;
}

.date {
  color: #666;
  font-size: 14px;
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
  background-color: #f5f5f5;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.location {
  color: #666;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 5px;
}

.location::before {
  content: '📍';
  font-size: 12px;
}

/* Month group styling */
.month-group {
  margin-bottom: 24px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.month-group:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.month-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #f8f8f8;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #e0e0e0;
}

.month-header:hover {
  background-color: #f0f0f0;
}

.month-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.expand-icon {
  color: #666;
  font-size: 12px;
  width: 12px;
  transition: transform 0.2s ease;
}

.month-header:hover .expand-icon {
  color: #333;
}

.month-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1em;
  font-weight: 600;
}

.record-count {
  background-color: #e0e0e0;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.9em;
  color: #555;
  font-weight: 500;
}

.month-records {
  padding: 8px;
  background-color: #fff;
  animation: fadeIn 0.3s ease-in-out;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .history-item.detailed {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
  }

  .record-details {
    width: 100%;
    flex-wrap: wrap;
    gap: 10px;
  }

  .badge,
  .timestamp,
  .session-type {
    font-size: 11px;
  }

  .day-name {
    font-size: 15px;
  }

  .date {
    font-size: 13px;
  }
}

/* Animation for expanding/collapsing month sections */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

.streak-note {
  display: block;
  font-size: 10px;
  color: #ff9800;
  margin-top: 3px;
}

.charts-section {
  margin-bottom: 30px;
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.charts-section h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.chart-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.chart-btn {
  background-color: #f5f5f5;
  border: none;
  padding: 8px 15px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.chart-btn.active {
  background-color: #4caf50;
  color: white;
}

.chart-btn:hover:not(.active) {
  background-color: #e0e0e0;
}

/* Update stat cards to make them more interactive */
.stat-card {
  flex: 1;
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.stat-card:nth-child(1) {
  border-top: 3px solid #9c27b0;
}

.stat-card:nth-child(2) {
  border-top: 3px solid #388e3c;
}

.stat-card:nth-child(3) {
  border-top: 3px solid #1976d2;
}

.stat-card:nth-child(4) {
  border-top: 3px solid #ff9800;
}

@media (max-width: 768px) {
  .chart-controls {
    justify-content: center;
  }
}

.not-enough-data {
  padding: 30px;
  text-align: center;
  color: #666;
  background-color: #f9f9f9;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .attendance-stats {
    flex-direction: column;
    gap: 10px;
  }
}

.scan-status {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.status-card {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.scan-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.scan-item:last-child {
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

.mixed-badge {
  background-color: #e1f5fe;
  color: #0277bd;
  border: 1px solid rgba(2, 119, 189, 0.2);
}

.mixed-badge::before {
  content: '🔄';
  margin-right: 5px;
  font-size: 12px;
}

.mini-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 5px;
}

.remote-mini {
  background-color: #e3f2fd;
  color: #1976d2;
}

.office-mini {
  background-color: #e8f5e9;
  color: #388e3c;
}
</style>
