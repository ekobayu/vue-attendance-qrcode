<template>
  <div class="attendance-list">
    <h2>Attendance Records</h2>

    <div class="tabs">
      <button @click="activeTab = 'daily'" :class="{ active: activeTab === 'daily' }">Daily Attendance</button>
      <button @click="activeTab = 'sessions'" :class="{ active: activeTab === 'sessions' }">Session Records</button>
      <button @click="activeTab = 'archived'" :class="{ active: activeTab === 'archived' }">Archived Sessions</button>
    </div>

    <!-- Daily Attendance Tab -->
    <div v-if="activeTab === 'daily'">
      <div class="filters">
        <div class="date-selector">
          <label for="date-select">Select Date:</label>
          <input type="date" id="date-select" v-model="selectedDate" @change="loadDailyAttendance" />
        </div>

        <div class="month-selector">
          <label for="month-select">Or Export by Month:</label>
          <div class="month-select-controls">
            <select id="month-select" v-model="selectedExportMonth">
              <option value="">Select Month</option>
              <option v-for="month in availableMonths" :key="month.value" :value="month.value">
                {{ month.label }}
              </option>
            </select>
            <button @click="exportMonthToCSV" class="export-month-btn" :disabled="!selectedExportMonth">
              Export Month
            </button>
          </div>
        </div>
      </div>

      <div v-if="selectedDate && attendees.length > 0" class="records">
        <h3>Attendance for {{ formatDate(selectedDate) }}</h3>

        <div class="table-controls">
          <div class="record-count">
            <span>Total Attendees: {{ uniqueAttendees.length }}</span>
          </div>

          <div class="search-box">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search by email or location..."
              @input="filterAttendees"
            />
            <button @click="searchQuery = ''" class="clear-search" v-if="searchQuery">✕</button>
          </div>
        </div>

        <table class="sortable-table">
          <thead>
            <tr>
              <th @click="sortTable('index')" :class="getSortClass('index')">
                # <span class="sort-icon">{{ getSortIcon('index') }}</span>
              </th>
              <th @click="sortTable('email')" :class="getSortClass('email')">
                Email <span class="sort-icon">{{ getSortIcon('email') }}</span>
              </th>
              <th @click="sortTable('inTime')" :class="getSortClass('inTime')">
                In Time <span class="sort-icon">{{ getSortIcon('inTime') }}</span>
              </th>
              <th @click="sortTable('locationIn')" :class="getSortClass('locationIn')">
                Location In <span class="sort-icon">{{ getSortIcon('locationIn') }}</span>
              </th>
              <th>Map URL In</th>
              <th @click="sortTable('outTime')" :class="getSortClass('outTime')">
                Out Time <span class="sort-icon">{{ getSortIcon('outTime') }}</span>
              </th>
              <th @click="sortTable('locationOut')" :class="getSortClass('locationOut')">
                Location Out <span class="sort-icon">{{ getSortIcon('locationOut') }}</span>
              </th>
              <th>Map URL Out</th>
              <th @click="sortTable('remote')" :class="getSortClass('remote')">
                Type <span class="sort-icon">{{ getSortIcon('remote') }}</span>
              </th>
              <th @click="sortTable('workSummary')" :class="getSortClass('workSummary')">
                Work Summary <span class="sort-icon">{{ getSortIcon('workSummary') }}</span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(attendee, index) in filteredAttendees" :key="attendee.userId">
              <td>{{ index + 1 }}</td>
              <td>{{ attendee.email }}</td>
              <td>
                {{ formatTime(attendee.inTime) }}
                <span
                  v-if="attendee.mixed"
                  class="mini-badge"
                  :class="attendee.firstScanDetails.remote ? 'remote-mini' : 'office-mini'"
                >
                  {{ attendee.firstScanDetails.remote ? 'Remote' : 'Office' }}
                </span>
              </td>
              <td>{{ attendee.locationIn || 'Office' }}</td>
              <td>
                <a
                  v-if="
                    attendee.firstScanDetails &&
                    attendee.firstScanDetails.remote &&
                    getMapUrlForScan(attendee.firstScanDetails)
                  "
                  :href="getMapUrlForScan(attendee.firstScanDetails)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="map-link"
                  title="View check-in location on Google Maps"
                >
                  <span class="map-icon">🗺️</span>
                </a>
              </td>
              <td>
                <span v-if="attendee.outTime">
                  {{ formatTime(attendee.outTime) }}
                  <span
                    v-if="attendee.mixed"
                    class="mini-badge"
                    :class="attendee.secondScanDetails.remote ? 'remote-mini' : 'office-mini'"
                  >
                    {{ attendee.secondScanDetails.remote ? 'Remote' : 'Office' }}
                  </span>
                </span>
                <span v-else class="pending-badge">Pending</span>
              </td>
              <td>{{ attendee.locationOut || (attendee.outTime ? 'Office' : '') }}</td>
              <td>
                <a
                  v-if="
                    attendee.secondScanDetails &&
                    attendee.secondScanDetails.remote &&
                    getMapUrlForScan(attendee.secondScanDetails)
                  "
                  :href="getMapUrlForScan(attendee.secondScanDetails)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="map-link"
                  title="View check-out location on Google Maps"
                >
                  <span class="map-icon">🗺️</span>
                </a>
              </td>
              <td>
                <span :class="attendee.badgeType">
                  {{ attendee.mixed ? 'Mixed' : attendee.remote ? 'Remote' : 'Office' }}
                </span>
              </td>
              <td>{{ attendee.workSummary || '' }}</td>
              <td>
                <button @click="confirmDeleteAttendance(attendee)" class="delete-btn" title="Remove attendance record">
                  <span class="delete-icon">🗑️</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="table-footer">
          <div class="pagination" v-if="totalPages > 1">
            <button @click="currentPage = 1" :disabled="currentPage === 1" class="page-btn">&laquo;</button>
            <button @click="currentPage--" :disabled="currentPage === 1" class="page-btn">&lsaquo;</button>
            <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
            <button @click="currentPage++" :disabled="currentPage === totalPages" class="page-btn">&rsaquo;</button>
            <button @click="currentPage = totalPages" :disabled="currentPage === totalPages" class="page-btn">
              &raquo;
            </button>
          </div>

          <div class="export-controls">
            <button @click="exportToCSV" class="export-btn">Export to CSV</button>
          </div>
        </div>
      </div>

      <div v-else-if="selectedDate" class="no-records">No attendance records found for this date.</div>
    </div>

    <!-- Sessions Tab with Month Grouping -->
    <div v-else-if="activeTab === 'sessions'">
      <div class="session-filters">
        <div class="date-filter">
          <label for="session-date-filter">Filter by Date:</label>
          <input type="date" id="session-date-filter" v-model="sessionDateFilter" @change="filterSessions" />
          <button @click="clearSessionFilter" class="clear-filter" v-if="sessionDateFilter">Clear</button>
        </div>

        <!-- <div class="search-box">
          <input type="text" v-model="sessionSearchQuery" placeholder="Search sessions..." @input="filterSessions" />
          <button @click="sessionSearchQuery = '' && filterSessions()" class="clear-search" v-if="sessionSearchQuery">
            ✕
          </button>
        </div> -->
      </div>

      <div class="session-list">
        <h3>Active Sessions</h3>

        <div v-if="Object.keys(groupedSessions).length === 0" class="no-records">No active sessions found.</div>

        <div v-else>
          <div class="batch-actions" v-if="getTotalSessionCount(groupedSessions) > 0">
            <div class="selection-info" v-if="selectedActiveSessions.length > 0">
              {{ selectedActiveSessions.length }} sessions selected
            </div>
            <button
              @click="selectAllActiveSessions"
              class="select-all-btn"
              v-if="selectedActiveSessions.length < getTotalSessionCount(groupedSessions)"
            >
              Select All
            </button>
            <button
              @click="clearActiveSelection"
              class="clear-selection-btn"
              v-else-if="selectedActiveSessions.length > 0"
            >
              Clear Selection
            </button>
            <button @click="batchArchiveSessions" class="batch-archive-btn" v-if="selectedActiveSessions.length > 0">
              Archive Selected
            </button>
          </div>

          <!-- Loop through each month group -->
          <div v-for="(sessions, month) in groupedSessions" :key="month" class="month-group">
            <div class="month-header" @click="toggleSessionMonthExpand(month)">
              <div class="month-title">
                <span class="expand-icon">{{ expandedSessionMonths[month] ? '▼' : '►' }}</span>
                <h4>{{ month }}</h4>
              </div>
              <span class="session-count">{{ sessions.length }} sessions</span>
            </div>

            <!-- Collapsible session list for this month -->
            <div v-if="expandedSessionMonths[month]" class="month-sessions">
              <!-- Change 'sessions' to 'groupedSessions[month]' -->
              <div v-for="session in groupedSessions[month]" :key="session.id" class="session-item">
                <div class="session-header">
                  <div class="session-select">
                    <input type="checkbox" :value="session.id" v-model="selectedActiveSessions" />
                  </div>
                  <div class="session-date">{{ formatDate(session.date) }}</div>
                  <div class="session-time">
                    {{ formatTime(session.startTime) }} - {{ formatTime(session.endTime) }}
                  </div>
                </div>

                <div class="session-details">
                  <div class="session-info">
                    <div class="session-type">{{ getSessionTypeDisplay(session.type) }}</div>
                    <div class="attendee-count">
                      <strong>{{ session.attendeeCount || getAttendeeCount(session) }}</strong> attendees
                    </div>
                  </div>

                  <div class="session-actions">
                    <button @click="viewSessionDetails(session)" class="view-btn">View Details</button>
                    <button @click="archiveSession(session)" class="archive-btn" v-if="!session.archived">
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Archived Sessions Tab with Collapsible Month Groups -->
    <div v-else-if="activeTab === 'archived'">
      <div class="session-filters">
        <div class="date-filter">
          <label for="archived-date-filter">Filter by Date:</label>
          <input type="date" id="archived-date-filter" v-model="archivedDateFilter" @change="filterArchivedSessions" />
          <button @click="clearArchivedFilter" class="clear-filter" v-if="archivedDateFilter">Clear</button>
        </div>

        <!-- <div class="search-box">
          <input
            type="text"
            v-model="archivedSearchQuery"
            placeholder="Search archived sessions..."
            @input="filterArchivedSessions"
          />
          <button
            @click="archivedSearchQuery = '' && filterArchivedSessions()"
            class="clear-search"
            v-if="archivedSearchQuery"
          >
            ✕
          </button>
        </div> -->
      </div>

      <div class="session-list">
        <h3>Archived Sessions</h3>

        <div v-if="Object.keys(groupedArchivedSessions).length === 0" class="no-records">
          No archived sessions found.
        </div>

        <div v-else>
          <div class="batch-actions" v-if="getTotalSessionCount(groupedArchivedSessions) > 0">
            <div class="selection-info" v-if="selectedArchivedSessions.length > 0">
              {{ selectedArchivedSessions.length }} sessions selected
            </div>
            <button
              @click="selectAllArchivedSessions"
              class="select-all-btn"
              v-if="selectedArchivedSessions.length < getTotalSessionCount(groupedArchivedSessions)"
            >
              Select All
            </button>
            <button
              @click="clearArchivedSelection"
              class="clear-selection-btn"
              v-else-if="selectedArchivedSessions.length > 0"
            >
              Clear Selection
            </button>
            <button
              @click="batchDeleteArchivedSessions"
              class="batch-delete-btn"
              v-if="selectedArchivedSessions.length > 0"
            >
              Delete Selected
            </button>
          </div>

          <!-- Loop through each month group -->
          <div v-for="(sessions, month) in groupedArchivedSessions" :key="month" class="month-group">
            <div class="month-header" @click="toggleMonthExpand(month)">
              <div class="month-title">
                <span class="expand-icon">{{ expandedMonths[month] ? '▼' : '►' }}</span>
                <h4>{{ month }}</h4>
              </div>
              <span class="session-count">{{ sessions.length }} sessions</span>
            </div>

            <!-- Collapsible session list for this month -->
            <div v-if="expandedMonths[month]" class="month-sessions">
              <!-- Loop through sessions in this month -->
              <!-- Change 'sessions' to 'groupedArchivedSessions[month]' -->
              <div v-for="session in groupedArchivedSessions[month]" :key="session.id" class="session-item archived">
                <div class="session-header">
                  <div class="session-select">
                    <input type="checkbox" :value="session.id" v-model="selectedArchivedSessions" />
                  </div>
                  <div class="session-date">{{ formatDate(session.date) }}</div>
                  <div class="session-time">
                    {{ formatTime(session.startTime) }} - {{ formatTime(session.endTime) }}
                  </div>
                </div>

                <div class="session-details">
                  <div class="session-info">
                    <div class="session-type">{{ getSessionTypeDisplay(session.type) }}</div>
                    <div class="archive-info">
                      <span class="archived-badge">Archived</span>
                      {{ formatDateTime(session.archivedAt) }}
                    </div>
                    <div class="attendee-count">
                      <strong>{{ getAttendeeCount(session) }}</strong> attendees
                    </div>
                  </div>

                  <div class="session-actions">
                    <button @click="viewSessionDetails(session)" class="view-btn">View Details</button>
                    <button @click="restoreSession(session)" class="restore-btn">Restore</button>
                    <button @click="deleteArchivedSession(session)" class="delete-btn-session">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Session Details Modal -->
    <div v-if="selectedSession" class="session-details-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Session Details</h3>
          <button @click="closeSessionDetails" class="close-button">&times;</button>
        </div>

        <div class="modal-body">
          <div class="session-summary">
            <div class="summary-item">
              <span class="label">Date:</span>
              <span class="value">{{ formatDate(selectedSession.date) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Time:</span>
              <span class="value"
                >{{ formatTime(selectedSession.startTime) }} - {{ formatTime(selectedSession.endTime) }}</span
              >
            </div>
            <div class="summary-item">
              <span class="label">Type:</span>
              <span class="value">{{ getSessionTypeDisplay(selectedSession.type) }}</span>
            </div>
            <div class="summary-item" v-if="selectedSession.archivedAt">
              <span class="label">Archived:</span>
              <span class="value">{{ formatDateTime(selectedSession.archivedAt) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Attendees:</span>
              <span class="value">{{ selectedSession.attendeeCount || sessionAttendees.length }}</span>
            </div>
          </div>

          <div class="attendee-search" v-if="sessionAttendees.length > 0">
            <input
              type="text"
              v-model="modalSearchQuery"
              placeholder="Search attendees..."
              @input="filterModalAttendees"
            />
          </div>

          <table v-if="filteredModalAttendees.length > 0">
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>In Time</th>
                <th>In Type</th>
                <th>Location In</th>
                <th>Map URL In</th>
                <th>Out Time</th>
                <th>Out Type</th>
                <th>Location Out</th>
                <th>Map URL Out</th>
                <th>Type</th>
                <th>Work Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(attendee, index) in filteredModalAttendees" :key="index">
                <td>{{ index + 1 }}</td>
                <td>{{ attendee.email }}</td>
                <td>{{ formatTime(attendee.inTime || attendee.timestamp) }}</td>
                <td>
                  <span :class="getInTypeBadgeClass(attendee)">
                    {{ getInType(attendee) }}
                  </span>
                </td>
                <td>{{ attendee.locationIn || (attendee.remote ? attendee.location : 'Office') }}</td>
                <td>
                  <a
                    v-if="
                      attendee.firstScanDetails &&
                      attendee.firstScanDetails.remote &&
                      getMapUrlForScan(attendee.firstScanDetails)
                    "
                    :href="getMapUrlForScan(attendee.firstScanDetails)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="map-link"
                    title="View check-in location on Google Maps"
                  >
                    <span class="map-icon">🗺️</span>
                  </a>
                </td>
                <td>{{ attendee.outTime ? formatTime(attendee.outTime) : 'Pending' }}</td>
                <td>
                  <span v-if="attendee.outTime" :class="getOutTypeBadgeClass(attendee)">
                    {{ getOutType(attendee) }}
                  </span>
                </td>
                <td>{{ attendee.locationOut || (attendee.outTime ? 'Office' : '') }}</td>
                <td>
                  <a
                    v-if="
                      attendee.secondScanDetails &&
                      attendee.secondScanDetails.remote &&
                      getMapUrlForScan(attendee.secondScanDetails)
                    "
                    :href="getMapUrlForScan(attendee.secondScanDetails)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="map-link"
                    title="View check-out location on Google Maps"
                  >
                    <span class="map-icon">🗺️</span>
                  </a>
                </td>
                <td>
                  <span :class="getAttendanceTypeBadgeClass(attendee)">
                    {{ getAttendanceType(attendee) }}
                  </span>
                </td>
                <td>{{ attendee.workSummary || '' }}</td>
                <td>
                  <button
                    @click="confirmRemoveAttendeeFromSession(attendee)"
                    class="delete-btn"
                    title="Remove from session"
                  >
                    <span class="delete-icon">🗑️</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="no-records">No attendees found matching your search.</div>

          <button @click="exportSessionToCSV" class="export-btn">Export to CSV</button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="confirmation-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ confirmModalTitle }}</h3>
          <button @click="cancelConfirmation" class="close-button">&times;</button>
        </div>

        <div class="modal-body">
          <p>{{ confirmModalMessage }}</p>

          <div class="modal-actions">
            <button @click="confirmAction" class="confirm-btn">{{ confirmButtonText }}</button>
            <button @click="cancelConfirmation" class="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { db } from '../firebase/config'
import { ref as dbRef, onValue, get, set, remove } from 'firebase/database'
import { useToast } from 'vue-toastification'
import { getTodayDateString } from '@/services/getTodayDateString'

export default {
  name: 'AttendanceList',
  data() {
    return {
      activeTab: 'daily',
      selectedDate: getTodayDateString(), // Today's date in YYYY-MM-DD format
      attendees: [],
      uniqueAttendees: [], // Grouped by user with in/out times
      sessions: [],
      archivedSessions: [],
      selectedSession: null,
      sessionAttendees: [],

      // Sorting and filtering for daily attendance
      sortKey: 'inTime',
      sortOrder: 'asc',
      searchQuery: '',
      filteredData: [],

      // Pagination for daily attendance
      currentPage: 1,
      itemsPerPage: 10,

      // Session filtering
      sessionDateFilter: '',
      sessionSearchQuery: '',
      filteredSessions: [],
      groupedSessions: {},
      expandedSessionMonths: {},

      // Archived session filtering
      archivedDateFilter: '',
      archivedSearchQuery: '',
      filteredArchivedSessions: [],
      groupedArchivedSessions: {},
      expandedMonths: {}, // Track which months are expanded

      // Modal search
      modalSearchQuery: '',
      filteredModalAttendees: [],

      // Confirmation modal
      showConfirmModal: false,
      confirmModalTitle: '',
      confirmModalMessage: '',
      confirmButtonText: 'Confirm',
      pendingAction: null,
      pendingActionData: null,

      selectedArchivedSessions: [],
      selectedActiveSessions: [],
      selectedExportMonth: '',
      availableMonths: [],
      monthlyAttendanceData: {},
      isLoadingMonthData: false
    }
  },
  computed: {
    filteredAttendees() {
      // Apply pagination
      const startIndex = (this.currentPage - 1) * this.itemsPerPage
      const endIndex = startIndex + this.itemsPerPage
      return this.filteredData.slice(startIndex, endIndex)
    },
    totalPages() {
      return Math.ceil(this.filteredData.length / this.itemsPerPage)
    },
    hasRemoteAttendees() {
      return this.filteredAttendees.some((attendee) => attendee.remote || attendee.mixed)
    }
  },
  watch: {
    currentPage() {
      // Scroll to top of table when page changes
      this.$nextTick(() => {
        const tableElement = document.querySelector('.sortable-table')
        if (tableElement) {
          tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    },
    activeTab(newTab) {
      // Refresh data when changing tabs
      if (newTab === 'daily') {
        this.loadDailyAttendance()
      } else if (newTab === 'sessions') {
        this.loadSessions()
        this.selectedActiveSessions = [] // Reset selection
      } else if (newTab === 'archived') {
        this.loadArchivedSessions()
        this.selectedArchivedSessions = [] // Reset selection
      }
    }
  },
  mounted() {
    this.loadDailyAttendance()
    this.loadSessions()
    this.loadArchivedSessions()
    this.loadAvailableMonths()
  },
  methods: {
    getUniqueAttendeeCount(attendees) {
      if (!attendees || !attendees.length) return 0

      // Count unique users by their user IDs
      const uniqueUserIds = new Set(
        attendees.filter((attendee) => attendee && attendee.userId).map((attendee) => attendee.userId)
      )

      return uniqueUserIds.size
    },

    getMapUrlForScan(scanDetails) {
      if (!scanDetails || !scanDetails.remote) return null

      // If the scan has a direct mapsUrl, use it
      if (scanDetails.mapsUrl) {
        return scanDetails.mapsUrl
      }

      // Otherwise, try to construct a URL from coordinates
      if (scanDetails.coordinates && scanDetails.coordinates.latitude && scanDetails.coordinates.longitude) {
        return `https://www.google.com/maps?q=${scanDetails.coordinates.latitude},${scanDetails.coordinates.longitude}`
      }

      return null
    },

    async loadAvailableMonths() {
      try {
        // Get reference to daily-attendance
        const attendanceRef = dbRef(db, 'daily-attendance')
        const snapshot = await get(attendanceRef)

        if (snapshot.exists()) {
          const dates = Object.keys(snapshot.val())
          const months = new Set()

          // Extract unique months from dates
          dates.forEach((dateStr) => {
            // Changed variable name from 'date' to 'dateStr'
            const [year, month] = dateStr.split('-')
            const monthValue = `${year}-${month}`
            const monthDate = new Date(year, parseInt(month) - 1, 1) // Changed variable name from 'date' to 'monthDate'
            const monthLabel = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })

            months.add(JSON.stringify({ value: monthValue, label: monthLabel }))
          })

          // Convert to array and sort (newest first)
          this.availableMonths = Array.from(months)
            .map((month) => JSON.parse(month))
            .sort((a, b) => b.value.localeCompare(a.value))
        } else {
          this.availableMonths = []
        }
      } catch (error) {
        console.error('Error loading available months:', error)
        this.availableMonths = []
      }
    },

    async exportMonthToCSV() {
      if (!this.selectedExportMonth) return

      this.isLoadingMonthData = true
      const toast = useToast()

      try {
        const [year, month] = this.selectedExportMonth.split('-')
        const monthLabel = new Date(year, parseInt(month) - 1, 1).toLocaleString('default', {
          month: 'long',
          year: 'numeric'
        })

        // Show loading toast
        toast.info(`Loading attendance data for ${monthLabel}...`, {
          position: 'top-center',
          timeout: false,
          closeOnClick: false,
          draggable: false,
          id: 'loading-month-data'
        })

        // Get last day of month
        const lastDay = new Date(year, month, 0).getDate()

        // Fetch all attendance records for the month
        const monthlyData = {}
        const promises = []

        // Create array of dates in the month
        const dates = []
        for (let day = 1; day <= lastDay; day++) {
          const date = `${year}-${month}-${day.toString().padStart(2, '0')}`
          dates.push(date)
        }

        // Fetch attendance data for each date
        for (const date of dates) {
          const promise = get(dbRef(db, `daily-attendance/${date}`))
            .then((snapshot) => {
              if (snapshot.exists()) {
                monthlyData[date] = snapshot.val()
              }
            })
            .catch((error) => {
              console.error(`Error fetching data for ${date}:`, error)
            })

          promises.push(promise)
        }

        // Wait for all fetches to complete
        await Promise.all(promises)

        // Process the data
        const processedData = this.processMonthlyAttendanceData(monthlyData)

        // Generate CSV
        if (processedData.length > 0) {
          const headers = [
            'Date',
            'Email',
            'In Time',
            'In Type',
            'Location In',
            'Map URL In',
            'Out Time',
            'Out Type',
            'Location Out',
            'Map URL Out',
            'Attendance Type',
            'Work Summary'
          ]

          let csvContent = headers.join(',') + '\n'

          processedData.forEach((record) => {
            const row = [
              record.date,
              record.email,
              this.formatTime(record.inTime),
              record.inType,
              record.locationIn || 'Office',
              record.mapUrlIn || '',
              record.outTime ? this.formatTime(record.outTime) : 'Pending',
              record.outType || '',
              record.locationOut || (record.outTime ? 'Office' : ''),
              record.mapUrlOut || '',
              record.attendanceType,
              record.workSummary || ''
            ]

            // Escape fields that might contain commas
            const escapedRow = row.map((field) => {
              if (field && typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
                return `"${field.replace(/"/g, '""')}"`
              }
              return field
            })

            csvContent += escapedRow.join(',') + '\n'
          })

          // Download the CSV
          this.downloadCSV(csvContent, `Attendance_${monthLabel.replace(' ', '_')}.csv`)

          // Show success toast
          toast.dismiss('loading-month-data')
          toast.success(`Exported ${processedData.length} attendance records for ${monthLabel}`, {
            position: 'top-center',
            duration: 3000
          })
        } else {
          toast.dismiss('loading-month-data')
          toast.warning(`No attendance records found for ${monthLabel}`, {
            position: 'top-center',
            duration: 3000
          })
        }
      } catch (error) {
        console.error('Error exporting monthly data:', error)
        toast.dismiss('loading-month-data')
        toast.error(`Failed to export monthly data: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      } finally {
        this.isLoadingMonthData = false
      }
    },

    processMonthlyAttendanceData(monthlyData) {
      const processedRecords = []

      // Process each date
      for (const date in monthlyData) {
        const dateData = monthlyData[date]

        // Group by user ID to combine check-in/check-out
        const userMap = new Map()

        // First pass: collect all records for each user
        for (const recordId in dateData) {
          const record = dateData[recordId]
          if (!record.userId) continue

          if (!userMap.has(record.userId)) {
            userMap.set(record.userId, [])
          }
          userMap.get(record.userId).push({
            ...record,
            id: recordId
          })
        }

        // Second pass: process each user's records for this date
        userMap.forEach((records) => {
          // Sort records by timestamp
          records.sort((a, b) => a.timestamp - b.timestamp)

          // Get first and last record
          const firstRecord = records[0]
          const lastRecord = records.length > 1 ? records[records.length - 1] : null

          // Determine attendance type
          let attendanceType = 'Office'
          let inType = 'Office'
          let outType = 'Office'
          let location = 'Office'

          // Get specific locations for in and out
          const locationIn = firstRecord.remote ? firstRecord.location || 'Remote' : 'Office'
          const locationOut =
            lastRecord && lastRecord !== firstRecord
              ? lastRecord.remote
                ? lastRecord.location || 'Remote'
                : 'Office'
              : null

          // Get map URLs for in and out
          const mapUrlIn = firstRecord.remote
            ? firstRecord.mapsUrl ||
              (firstRecord.coordinates
                ? `https://www.google.com/maps?q=${firstRecord.coordinates.latitude},${firstRecord.coordinates.longitude}`
                : null)
            : null

          const mapUrlOut =
            lastRecord && lastRecord !== firstRecord && lastRecord.remote
              ? lastRecord.mapsUrl ||
                (lastRecord.coordinates
                  ? `https://www.google.com/maps?q=${lastRecord.coordinates.latitude},${lastRecord.coordinates.longitude}`
                  : null)
              : null

          if (firstRecord.remote && (!lastRecord || lastRecord.remote)) {
            // Both records are remote or only first scan exists and is remote
            attendanceType = 'Remote'
            inType = 'Remote'
            outType = lastRecord ? 'Remote' : ''
            location = firstRecord.location || 'Remote'
          } else if (!firstRecord.remote && lastRecord && !lastRecord.remote) {
            // Both records are office
            attendanceType = 'Office'
            inType = 'Office'
            outType = 'Office'
            location = 'Office'
          } else if (firstRecord && lastRecord) {
            // Mixed: one scan is remote, one is office
            attendanceType = 'Mixed'
            inType = firstRecord.remote ? 'Remote' : 'Office'
            outType = lastRecord.remote ? 'Remote' : 'Office'

            // For mixed, prioritize showing remote location
            if (firstRecord.remote) {
              location = firstRecord.location || 'Remote'
            } else if (lastRecord.remote) {
              location = lastRecord.location || 'Remote'
            }
          }

          // Add to processed records
          processedRecords.push({
            date: date,
            email: firstRecord.email,
            inTime: firstRecord.timestamp,
            outTime: lastRecord && lastRecord !== firstRecord ? lastRecord.timestamp : null,
            attendanceType: attendanceType,
            inType: inType,
            outType: outType,
            location: location,
            locationIn: locationIn,
            locationOut: locationOut,
            mapUrlIn: mapUrlIn,
            mapUrlOut: mapUrlOut,
            workSummary: firstRecord.workSummary || ''
          })
        })
      }

      // Sort by date and then by email
      return processedRecords.sort((a, b) => {
        // First sort by date
        const dateComparison = a.date.localeCompare(b.date)
        if (dateComparison !== 0) return dateComparison

        // Then by email
        return a.email.localeCompare(b.email)
      })
    },

    async loadDailyAttendance() {
      if (!this.selectedDate) {
        this.attendees = []
        this.uniqueAttendees = []
        this.filteredData = []
        return
      }

      const attendanceRef = dbRef(db, `daily-attendance/${this.selectedDate}`)
      onValue(attendanceRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          this.attendees = Object.keys(data).map((key, index) => ({
            id: key,
            originalIndex: index, // Store original index for sorting
            ...data[key],
            location: data[key].location || 'Office', // Ensure location exists

            // Ensure mapsUrl exists if coordinates are available but no mapsUrl
            mapsUrl:
              data[key].mapsUrl ||
              (data[key].coordinates
                ? `https://www.google.com/maps?q=${data[key].coordinates.latitude},${data[key].coordinates.longitude}`
                : null)
          }))

          // Group attendees by userId to show in/out times
          this.processAttendanceRecords()

          // Initial sort by in time
          this.sortTable('inTime')
          this.filterAttendees()
        } else {
          this.attendees = []
          this.uniqueAttendees = []
          this.filteredData = []
        }
      })
    },

    processAttendanceRecords() {
      // Group attendees by userId
      const userAttendanceMap = new Map()

      // First pass: collect all records for each user
      this.attendees.forEach((record) => {
        if (!record.userId) return // Skip records without userId

        if (!userAttendanceMap.has(record.userId)) {
          userAttendanceMap.set(record.userId, [])
        }
        userAttendanceMap.get(record.userId).push(record)
      })

      // Second pass: process each user's records
      this.uniqueAttendees = Array.from(userAttendanceMap.values()).map((records) => {
        // Sort records by timestamp
        records.sort((a, b) => a.timestamp - b.timestamp)

        // Get the first and last record
        const firstRecord = records[0]
        const lastRecord = records.length > 1 ? records[records.length - 1] : null

        // Determine attendance type (office, remote, or mixed)
        let attendanceType = 'office'
        let badgeType = 'in-person-badge'
        let location = 'Office'

        // Get specific locations for in and out
        const locationIn = firstRecord.remote ? firstRecord.location || 'Remote' : 'Office'
        const locationOut =
          lastRecord && lastRecord !== firstRecord
            ? lastRecord.remote
              ? lastRecord.location || 'Remote'
              : 'Office'
            : null

        // Get map URLs for in and out
        const mapUrlIn = firstRecord.remote
          ? firstRecord.mapsUrl ||
            (firstRecord.coordinates
              ? `https://www.google.com/maps?q=${firstRecord.coordinates.latitude},${firstRecord.coordinates.longitude}`
              : null)
          : null

        const mapUrlOut =
          lastRecord && lastRecord !== firstRecord && lastRecord.remote
            ? lastRecord.mapsUrl ||
              (lastRecord.coordinates
                ? `https://www.google.com/maps?q=${lastRecord.coordinates.latitude},${lastRecord.coordinates.longitude}`
                : null)
            : null

        if (firstRecord.remote && (!lastRecord || lastRecord.remote)) {
          // Both records are remote or only first scan exists and is remote
          attendanceType = 'remote'
          badgeType = 'remote-badge'
          location = firstRecord.location || ''
        } else if (!firstRecord.remote && lastRecord && !lastRecord.remote) {
          // Both records are office
          attendanceType = 'office'
          badgeType = 'in-person-badge'
          location = 'Office'
        } else if (firstRecord && lastRecord) {
          // Mixed: one scan is remote, one is office
          attendanceType = 'mixed'
          badgeType = 'mixed-badge'

          // For mixed, prioritize showing remote location
          if (firstRecord.remote) {
            location = firstRecord.location || ''
          } else if (lastRecord.remote) {
            location = lastRecord.location || ''
          }
        }

        // Create a combined record with in/out times
        return {
          userId: firstRecord.userId,
          email: firstRecord.email,
          inTime: firstRecord.timestamp,
          outTime: lastRecord && lastRecord !== firstRecord ? lastRecord.timestamp : null,
          remote: attendanceType === 'remote',
          mixed: attendanceType === 'mixed',
          badgeType: badgeType,
          location: location,
          locationIn: locationIn,
          locationOut: locationOut,
          mapUrlIn: mapUrlIn,
          mapUrlOut: mapUrlOut,
          coordinates: firstRecord.remote
            ? firstRecord.coordinates
            : lastRecord && lastRecord.remote
            ? lastRecord.coordinates
            : null,
          mapsUrl: firstRecord.remote
            ? firstRecord.mapsUrl
            : lastRecord && lastRecord.remote
            ? lastRecord.mapsUrl
            : null,
          sessionType: firstRecord.sessionType,
          // Store details of both records for reference
          firstScanDetails: firstRecord,
          secondScanDetails: lastRecord,
          // Store all record IDs for potential deletion
          recordIds: records.map((r) => r.id),
          // Store original index for sorting
          originalIndex: firstRecord.originalIndex,
          workSummary: firstRecord.workSummary || ''
        }
      })
    },

    async loadSessions() {
      const sessionsRef = dbRef(db, 'attendance-sessions')
      onValue(sessionsRef, async (snapshot) => {
        const data = snapshot.val()
        if (data) {
          // Create an array of sessions with basic data
          const sessionsArray = Object.keys(data).map((key) => ({
            id: key,
            ...data[key]
          }))

          // Sort sessions by date and time
          sessionsArray.sort((a, b) => new Date(b.date) - new Date(a.date) || b.startTime - a.startTime)

          // Set sessions array immediately for UI responsiveness
          this.sessions = sessionsArray
          this.filterSessions()

          // Then compute accurate attendee counts in the background
          for (const session of sessionsArray) {
            const count = await this.getDirectAttendeeCount(session.id, false)
            // Update the session with the accurate count
            session.attendeeCount = count
          }

          // Update the sessions array with the new counts
          this.sessions = [...sessionsArray]
          this.filterSessions()
        } else {
          this.sessions = []
          this.filteredSessions = []
          this.groupedSessions = {}
        }
      })
    },

    async loadArchivedSessions() {
      const archivedRef = dbRef(db, 'archived-sessions')
      onValue(archivedRef, async (snapshot) => {
        const data = snapshot.val()
        if (data) {
          // Create an array of archived sessions with basic data
          const archivedArray = Object.keys(data).map((key) => ({
            id: key,
            ...data[key]
          }))

          // Sort by archived timestamp
          archivedArray.sort((a, b) => b.archivedAt - a.archivedAt)

          // Set archived sessions array immediately for UI responsiveness
          this.archivedSessions = archivedArray
          this.filterArchivedSessions()

          // Then compute accurate attendee counts in the background
          for (const session of archivedArray) {
            const count = await this.getDirectAttendeeCount(session.id, true)
            // Update the session with the accurate count
            session.attendeeCount = count
          }

          // Update the archived sessions array with the new counts
          this.archivedSessions = [...archivedArray]
          this.filterArchivedSessions()
        } else {
          this.archivedSessions = []
          this.filteredArchivedSessions = []
        }
      })
    },

    confirmDeleteAttendance(attendee) {
      this.confirmModalTitle = 'Remove Attendance Record'
      this.confirmModalMessage = `Are you sure you want to remove the attendance record for ${attendee.email}?`
      this.confirmButtonText = 'Remove'
      this.pendingAction = 'deleteAttendance'
      this.pendingActionData = attendee
      this.showConfirmModal = true
    },

    confirmRemoveAttendeeFromSession(attendee) {
      this.confirmModalTitle = 'Remove From Session'
      this.confirmModalMessage = `Are you sure you want to remove ${attendee.email} from this session?`
      this.confirmButtonText = 'Remove'
      this.pendingAction = 'removeFromSession'
      this.pendingActionData = attendee
      this.showConfirmModal = true
    },

    async removeAttendeeFromSession(attendee) {
      const toast = useToast()
      try {
        if (!this.selectedSession || !attendee || !attendee.userId) {
          throw new Error('Missing required information')
        }

        // Determine path based on whether session is archived
        const isArchived = !!this.selectedSession.archivedAt
        const basePath = isArchived ? 'archived-sessions' : 'attendance-sessions'

        // Reference to the specific attendee record in the session
        const attendeeRef = dbRef(db, `${basePath}/${this.selectedSession.id}/attendees/${attendee.userId}`)

        // Also find and remove from user's personal attendance history
        const userRef = dbRef(db, `user-attendance/${attendee.userId}/${this.selectedSession.date}`)

        // Remove from session attendees
        await remove(attendeeRef)

        // Remove from user's attendance history
        await remove(userRef)

        // Update the attendees list in the modal
        this.sessionAttendees = this.sessionAttendees.filter((a) => a.userId !== attendee.userId)
        this.filterModalAttendees()

        // Show success message
        toast.success(`${attendee.email} has been removed from this session.`, {
          position: 'top-center',
          duration: 3000
        })
      } catch (error) {
        console.error('Error removing attendee from session:', error)
        toast.error(`Failed to remove attendee: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      }
    },

    async deleteAttendanceRecord(attendee) {
      const toast = useToast()
      try {
        if (!this.selectedDate || !attendee || !attendee.userId) {
          throw new Error('Missing required information to delete record')
        }

        // Get the session IDs for this attendance record
        const sessionIds = new Set()

        // Collect session IDs from the records
        if (attendee.firstScanDetails && attendee.firstScanDetails.sessionId) {
          sessionIds.add(attendee.firstScanDetails.sessionId)
        }
        if (attendee.secondScanDetails && attendee.secondScanDetails.sessionId) {
          sessionIds.add(attendee.secondScanDetails.sessionId)
        }

        // Delete all records for this user on this date
        if (attendee.recordIds && attendee.recordIds.length > 0) {
          // Delete each record from daily attendance
          for (const recordId of attendee.recordIds) {
            const recordRef = dbRef(db, `daily-attendance/${this.selectedDate}/${recordId}`)
            await remove(recordRef)
          }
        }

        // Also remove from user's personal attendance history
        const userRef = dbRef(db, `user-attendance/${attendee.userId}/${this.selectedDate}`)
        await remove(userRef)

        // Remove from active sessions
        for (const sessionId of sessionIds) {
          // Check active sessions first
          const activeSessionRef = dbRef(db, `attendance-sessions/${sessionId}/attendees`)
          const activeSnapshot = await get(activeSessionRef)

          if (activeSnapshot.exists()) {
            // Find all entries for this user in the session
            const attendeesToDelete = []
            Object.entries(activeSnapshot.val()).forEach(([key, value]) => {
              // Check if this entry belongs to the user we're deleting
              if ((value.userId && value.userId === attendee.userId) || key.startsWith(attendee.userId + '_')) {
                attendeesToDelete.push(key)
              }
            })

            // Delete each entry
            for (const key of attendeesToDelete) {
              await remove(dbRef(db, `attendance-sessions/${sessionId}/attendees/${key}`))
              console.log(`Removed ${attendee.email} from active session ${sessionId}, key: ${key}`)
            }
          }

          // Check archived sessions
          const archivedSessionRef = dbRef(db, `archived-sessions/${sessionId}/attendees`)
          const archivedSnapshot = await get(archivedSessionRef)

          if (archivedSnapshot.exists()) {
            // Find all entries for this user in the archived session
            const attendeesToDelete = []
            Object.entries(archivedSnapshot.val()).forEach(([key, value]) => {
              // Check if this entry belongs to the user we're deleting
              if ((value.userId && value.userId === attendee.userId) || key.startsWith(attendee.userId + '_')) {
                attendeesToDelete.push(key)
              }
            })

            // Delete each entry
            for (const key of attendeesToDelete) {
              await remove(dbRef(db, `archived-sessions/${sessionId}/attendees/${key}`))
              console.log(`Removed ${attendee.email} from archived session ${sessionId}, key: ${key}`)
            }
          }
        }

        // Show success message
        toast.success(`Attendance record for ${attendee.email} has been removed.`, {
          position: 'top-center',
          duration: 3000
        })

        // The real-time listener will automatically update the UI
      } catch (error) {
        console.error('Error deleting attendance record:', error)
        toast.error(`Failed to delete record: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      }
    },

    filterSessions() {
      let filtered = this.sessions

      // Filter by date if specified
      if (this.sessionDateFilter) {
        filtered = filtered.filter((session) => session.date === this.sessionDateFilter)
      }

      // Filter by search query
      if (this.sessionSearchQuery) {
        const query = this.sessionSearchQuery.toLowerCase()
        filtered = filtered.filter(
          (session) =>
            (session.type && this.getSessionTypeDisplay(session.type).toLowerCase().includes(query)) ||
            (session.date && session.date.toLowerCase().includes(query))
        )
      }

      // Reset selection when filter changes
      this.selectedActiveSessions = []

      // Store filtered sessions
      this.filteredSessions = filtered

      // Group by month
      this.groupedSessions = this.groupSessionsByMonth(filtered)

      // Auto-expand the first month or if there's only one month
      const months = Object.keys(this.groupedSessions)

      // Create a new object for expandedSessionMonths
      const newExpandedMonths = { ...this.expandedSessionMonths }

      if (months.length === 1) {
        // If there's only one month, expand it
        newExpandedMonths[months[0]] = true
      } else if (months.length > 0 && this.sessionDateFilter) {
        // If filtering by date, expand all months
        months.forEach((month) => {
          newExpandedMonths[month] = true
        })
      }

      // Update the expandedSessionMonths object
      this.expandedSessionMonths = newExpandedMonths
    },

    filterArchivedSessions() {
      let filtered = this.archivedSessions

      // Filter by date if specified
      if (this.archivedDateFilter) {
        filtered = filtered.filter((session) => session.date === this.archivedDateFilter)
      }

      // Filter by search query
      if (this.archivedSearchQuery) {
        const query = this.archivedSearchQuery.toLowerCase()
        filtered = filtered.filter(
          (session) =>
            (session.type && this.getSessionTypeDisplay(session.type).toLowerCase().includes(query)) ||
            (session.date && session.date.toLowerCase().includes(query))
        )
      }

      // Reset selection when filter changes
      this.selectedArchivedSessions = []

      // Group by month
      this.filteredArchivedSessions = filtered
      this.groupedArchivedSessions = this.groupSessionsByMonth(filtered)

      // Auto-expand the first month or if there's only one month
      const months = Object.keys(this.groupedArchivedSessions)

      // Create a new object for expandedMonths
      const newExpandedMonths = { ...this.expandedMonths }

      if (months.length === 1) {
        // If there's only one month, expand it
        newExpandedMonths[months[0]] = true
      } else if (months.length > 0 && this.archivedDateFilter) {
        // If filtering by date, expand all months
        months.forEach((month) => {
          newExpandedMonths[month] = true
        })
      }

      // Update the expandedMonths object
      this.expandedMonths = newExpandedMonths
    },

    groupSessionsByMonth(sessions) {
      const grouped = {}

      sessions.forEach((session) => {
        // Extract month and year from the date
        const date = new Date(session.date)
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' })

        // Create array for this month if it doesn't exist
        if (!grouped[monthYear]) {
          grouped[monthYear] = []
        }

        // Add session to the appropriate month group
        grouped[monthYear].push(session)
      })

      // Sort the sessions within each month by date (newest first)
      Object.keys(grouped).forEach((month) => {
        grouped[month].sort((a, b) => new Date(b.date) - new Date(a.date))
      })

      return grouped
    },

    toggleMonthExpand(month) {
      // Create a new object with the updated value to ensure reactivity
      this.expandedMonths = {
        ...this.expandedMonths,
        [month]: !this.expandedMonths[month]
      }
    },

    toggleSessionMonthExpand(month) {
      // Create a new object with the updated value to ensure reactivity
      this.expandedSessionMonths = {
        ...this.expandedSessionMonths,
        [month]: !this.expandedSessionMonths[month]
      }
    },

    hasCoordinates(attendee) {
      return attendee.coordinates && attendee.coordinates.latitude && attendee.coordinates.longitude
    },

    getGoogleMapsUrl(attendee) {
      if (!this.hasCoordinates(attendee)) return null

      const { latitude, longitude } = attendee.coordinates
      return `https://www.google.com/maps?q=${latitude},${longitude}`
    },

    clearSessionFilter() {
      this.sessionDateFilter = ''
      this.filterSessions()
    },

    clearArchivedFilter() {
      this.archivedDateFilter = ''
      this.filterArchivedSessions()
    },

    filterModalAttendees() {
      if (!this.modalSearchQuery) {
        this.filteredModalAttendees = this.sessionAttendees
        return
      }

      const query = this.modalSearchQuery.toLowerCase()
      this.filteredModalAttendees = this.sessionAttendees.filter(
        (attendee) =>
          (attendee.email && attendee.email.toLowerCase().includes(query)) ||
          (attendee.location && attendee.location.toLowerCase().includes(query))
      )
    },

    sortTable(key) {
      // Reset to first page when sorting
      this.currentPage = 1

      // If clicking the same column, toggle sort order
      if (this.sortKey === key) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortKey = key
        // Default sort order based on column
        if (
          key === 'email' ||
          key === 'location' ||
          key === 'locationIn' ||
          key === 'locationOut' ||
          key === 'sessionType'
        ) {
          this.sortOrder = 'asc'
        } else {
          this.sortOrder = 'desc'
        }
      }

      this.filterAttendees()
    },

    filterAttendees() {
      // Filter by search query
      let filtered = this.uniqueAttendees

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        filtered = filtered.filter(
          (attendee) =>
            (attendee.email && attendee.email.toLowerCase().includes(query)) ||
            (attendee.location && attendee.location.toLowerCase().includes(query)) ||
            (attendee.locationIn && attendee.locationIn.toLowerCase().includes(query)) ||
            (attendee.locationOut && attendee.locationOut.toLowerCase().includes(query))
        )
      }

      // Sort the filtered data
      filtered.sort((a, b) => {
        let comparison = 0

        switch (this.sortKey) {
          case 'index':
            comparison = a.originalIndex - b.originalIndex
            break
          case 'email':
            comparison = a.email.localeCompare(b.email)
            break
          case 'inTime':
            comparison = a.inTime - b.inTime
            break
          case 'outTime':
            // Handle null outTime values
            if (a.outTime === null && b.outTime === null) {
              comparison = 0
            } else if (a.outTime === null) {
              comparison = 1 // Null values come last in ascending order
            } else if (b.outTime === null) {
              comparison = -1
            } else {
              comparison = a.outTime - b.outTime
            }
            break
          case 'sessionType':
            comparison = (a.sessionType || '').localeCompare(b.sessionType || '')
            break
          case 'remote':
            comparison = a.remote === b.remote ? 0 : a.remote ? 1 : -1
            break
          case 'location':
            comparison = (a.location || '').localeCompare(b.location || '')
            break
          case 'locationIn':
            comparison = (a.locationIn || '').localeCompare(b.locationIn || '')
            break
          case 'locationOut':
            // Handle null locationOut values
            if (!a.locationOut && !b.locationOut) {
              comparison = 0
            } else if (!a.locationOut) {
              comparison = 1 // Null values come last in ascending order
            } else if (!b.locationOut) {
              comparison = -1
            } else {
              comparison = a.locationOut.localeCompare(b.locationOut)
            }
            break
          default:
            comparison = 0
        }

        return this.sortOrder === 'asc' ? comparison : -comparison
      })

      this.filteredData = filtered
    },

    getSortClass(key) {
      return this.sortKey === key ? `sorted ${this.sortOrder}` : ''
    },

    getSortIcon(key) {
      if (this.sortKey !== key) return '⇅'
      return this.sortOrder === 'asc' ? '↑' : '↓'
    },

    getAttendeeCount(session) {
      // Check if attendees property exists
      if (!session || !session.attendees) {
        return 0
      }

      try {
        // If attendees is an object (key-value pairs)
        if (typeof session.attendees === 'object' && !Array.isArray(session.attendees)) {
          // Extract unique user IDs from the keys
          const uniqueUserIds = new Set()

          Object.keys(session.attendees).forEach((key) => {
            // Keys might be in format "userId_timestamp" or just plain objects with userId property
            const attendee = session.attendees[key]

            if (typeof attendee === 'object' && attendee.userId) {
              // If the attendee object has a userId property, use that
              uniqueUserIds.add(attendee.userId)
            } else {
              // Otherwise try to extract userId from the key (format: userId_timestamp)
              const userId = key.split('_')[0]
              if (userId) {
                uniqueUserIds.add(userId)
              }
            }
          })

          return uniqueUserIds.size
        }

        // If attendees is an array
        if (Array.isArray(session.attendees)) {
          const uniqueUserIds = new Set(
            session.attendees.filter((attendee) => attendee && attendee.userId).map((attendee) => attendee.userId)
          )
          return uniqueUserIds.size
        }

        // If attendees is a number (count)
        if (typeof session.attendees === 'number') {
          return session.attendees
        }
      } catch (error) {
        console.error('Error counting attendees:', error)
      }

      // Default case or error
      return 0
    },

    async getDirectAttendeeCount(sessionId, isArchived = false) {
      try {
        const path = isArchived
          ? `archived-sessions/${sessionId}/attendees`
          : `attendance-sessions/${sessionId}/attendees`

        const attendeesRef = dbRef(db, path)
        const snapshot = await get(attendeesRef)

        if (!snapshot.exists()) {
          return 0
        }

        const attendees = snapshot.val()
        const uniqueUserIds = new Set()

        // Process each attendee entry
        Object.entries(attendees).forEach(([key, attendee]) => {
          if (attendee && attendee.userId) {
            uniqueUserIds.add(attendee.userId)
          } else {
            // Try to extract userId from the key (format: userId_timestamp)
            const userId = key.split('_')[0]
            if (userId) {
              uniqueUserIds.add(userId)
            }
          }
        })

        return uniqueUserIds.size
      } catch (error) {
        console.error('Error getting direct attendee count:', error)
        return 0
      }
    },

    getSessionTypeDisplay(type) {
      if (type === 'office') {
        return 'Office'
      } else if (type === 'custom') {
        return 'Custom Session'
      }
      return type || 'Unknown'
    },

    async viewSessionDetails(session) {
      this.selectedSession = session
      this.modalSearchQuery = ''

      // Determine where to look for attendees based on whether session is archived
      const isArchived = !!session.archivedAt
      const path = isArchived
        ? `archived-sessions/${session.id}/attendees`
        : `attendance-sessions/${session.id}/attendees`

      // Load attendees for this session
      const attendeesRef = dbRef(db, path)
      const snapshot = await get(attendeesRef)

      if (snapshot.exists()) {
        // First, collect all attendees by user ID
        const attendeesByUser = {}
        const rawAttendees = snapshot.val()

        // Store the raw count for debugging
        const rawCount = Object.keys(rawAttendees).length
        console.log(`Raw attendee entries: ${rawCount}`)

        // Process each attendee entry
        Object.entries(rawAttendees).forEach(([key, attendeeData]) => {
          // Try to get userId from the attendee data or from the key
          const userId = attendeeData.userId || key.split('_')[0]

          if (!userId) {
            console.log(`No userId found for key: ${key}`)
            return
          }

          if (!attendeesByUser[userId]) {
            attendeesByUser[userId] = []
          }

          attendeesByUser[userId].push({
            key,
            ...attendeeData,
            location: attendeeData.location || 'Office',
            mapsUrl:
              attendeeData.mapsUrl ||
              (attendeeData.coordinates
                ? `https://www.google.com/maps?q=${attendeeData.coordinates.latitude},${attendeeData.coordinates.longitude}`
                : null)
          })
        })

        // Log the unique user count
        const uniqueUserCount = Object.keys(attendeesByUser).length
        console.log(`Unique users: ${uniqueUserCount}`)

        // Update the session's attendee count for consistency
        if (session.attendeeCount !== uniqueUserCount) {
          console.log(`Updating session attendee count from ${session.attendeeCount} to ${uniqueUserCount}`)
          session.attendeeCount = uniqueUserCount
        }

        // Process each user's records
        this.sessionAttendees = Object.values(attendeesByUser)
          .map((records) => {
            // Sort records by timestamp
            records.sort((a, b) => a.timestamp - b.timestamp)

            // Get first and last record
            const firstRecord = records[0]
            const lastRecord = records.length > 1 ? records[records.length - 1] : null

            // Determine attendance type
            let attendanceType = 'Office'
            let mixed = false

            // Get specific locations for in and out
            const locationIn = firstRecord.remote ? firstRecord.location || 'Remote' : 'Office'
            const locationOut =
              lastRecord && lastRecord !== firstRecord
                ? lastRecord.remote
                  ? lastRecord.location || 'Remote'
                  : 'Office'
                : null

            // Get map URLs for in and out
            const mapUrlIn = firstRecord.remote
              ? firstRecord.mapsUrl ||
                (firstRecord.coordinates
                  ? `https://www.google.com/maps?q=${firstRecord.coordinates.latitude},${firstRecord.coordinates.longitude}`
                  : null)
              : null

            const mapUrlOut =
              lastRecord && lastRecord !== firstRecord && lastRecord.remote
                ? lastRecord.mapsUrl ||
                  (lastRecord.coordinates
                    ? `https://www.google.com/maps?q=${lastRecord.coordinates.latitude},${lastRecord.coordinates.longitude}`
                    : null)
                : null

            if (firstRecord.remote && (!lastRecord || lastRecord.remote)) {
              // Both records are remote or only first scan exists and is remote
              attendanceType = 'Remote'
            } else if (!firstRecord.remote && lastRecord && !lastRecord.remote) {
              // Both records are office
              attendanceType = 'Office'
            } else if (firstRecord && lastRecord && firstRecord.remote !== lastRecord.remote) {
              // Mixed: one scan is remote, one is office
              attendanceType = 'Mixed'
              mixed = true
            }

            return {
              userId: firstRecord.userId,
              email: firstRecord.email,
              timestamp: firstRecord.timestamp, // Keep original timestamp for backward compatibility
              inTime: firstRecord.timestamp,
              outTime: lastRecord && lastRecord !== firstRecord ? lastRecord.timestamp : null,
              remote: attendanceType === 'Remote',
              mixed: mixed,
              attendanceType: attendanceType,
              location: firstRecord.location || 'Office', // Keep original location for backward compatibility
              locationIn: locationIn,
              locationOut: locationOut,
              mapUrlIn: mapUrlIn,
              mapUrlOut: mapUrlOut,
              coordinates: firstRecord.coordinates,
              mapsUrl: firstRecord.mapsUrl,
              // Store details of both records for reference
              firstScanDetails: firstRecord,
              secondScanDetails: lastRecord
            }
          })
          .sort((a, b) => a.timestamp - b.timestamp)

        // Initialize filtered attendees
        this.filteredModalAttendees = [...this.sessionAttendees]

        // Log the final processed count
        console.log(`Processed attendees: ${this.sessionAttendees.length}`)
      } else {
        this.sessionAttendees = []
        this.filteredModalAttendees = []

        // Update the session's attendee count
        session.attendeeCount = 0
      }
    },

    closeSessionDetails() {
      this.selectedSession = null
      this.sessionAttendees = []
      this.filteredModalAttendees = []
    },

    archiveSession(session) {
      this.confirmModalTitle = 'Archive Session'
      this.confirmModalMessage = `Are you sure you want to archive the session from ${this.formatDate(session.date)}?`
      this.confirmButtonText = 'Archive'
      this.pendingAction = 'archive'
      this.pendingActionData = session
      this.showConfirmModal = true
    },

    restoreSession(session) {
      this.confirmModalTitle = 'Restore Session'
      this.confirmModalMessage = `Are you sure you want to restore the archived session from ${this.formatDate(
        session.date
      )}?`
      this.confirmButtonText = 'Restore'
      this.pendingAction = 'restore'
      this.pendingActionData = session
      this.showConfirmModal = true
    },

    deleteArchivedSession(session) {
      this.confirmModalTitle = 'Delete Archived Session'
      this.confirmModalMessage = `Are you sure you want to permanently delete the archived session from ${this.formatDate(
        session.date
      )}? This action cannot be undone.`
      this.confirmButtonText = 'Delete'
      this.pendingAction = 'deleteArchived'
      this.pendingActionData = session
      this.showConfirmModal = true
    },

    async confirmAction() {
      if (this.pendingAction === 'archive') {
        await this.performArchiveSession(this.pendingActionData)
      } else if (this.pendingAction === 'restore') {
        await this.performRestoreSession(this.pendingActionData)
      } else if (this.pendingAction === 'deleteAttendance') {
        await this.deleteAttendanceRecord(this.pendingActionData)
      } else if (this.pendingAction === 'removeFromSession') {
        await this.removeAttendeeFromSession(this.pendingActionData)
      } else if (this.pendingAction === 'deleteArchived') {
        await this.performDeleteArchivedSession(this.pendingActionData)
      } else if (this.pendingAction === 'batchDeleteArchived') {
        await this.performBatchDeleteArchivedSessions(this.pendingActionData)
      } else if (this.pendingAction === 'batchArchive') {
        await this.performBatchArchiveSessions(this.pendingActionData)
      }

      this.showConfirmModal = false
      this.pendingAction = null
      this.pendingActionData = null
    },

    cancelConfirmation() {
      this.showConfirmModal = false
      this.pendingAction = null
      this.pendingActionData = null
    },

    async performArchiveSession(session) {
      const toast = useToast()
      try {
        if (!session || !session.id) {
          throw new Error('Invalid session data')
        }

        // Add archived timestamp
        const archivedSession = {
          ...session,
          archivedAt: Date.now()
        }

        // Save to archived sessions
        const archivedRef = dbRef(db, `archived-sessions/${session.id}`)
        await set(archivedRef, archivedSession)

        // Remove from active sessions
        const activeRef = dbRef(db, `attendance-sessions/${session.id}`)
        await remove(activeRef)

        // Show success message using toast
        toast.success(`Session from ${this.formatDate(session.date)} has been archived.`, {
          position: 'top-center',
          duration: 3000
        })

        // Refresh data
        this.loadSessions()
        this.loadArchivedSessions()

        // If the archived session was being viewed in the modal, close it
        if (this.selectedSession && this.selectedSession.id === session.id) {
          this.closeSessionDetails()
        }
      } catch (error) {
        console.error('Error archiving session:', error)
        toast.error(`Failed to archive session: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      }
    },

    async performRestoreSession(session) {
      const toast = useToast()
      try {
        if (!session || !session.id) {
          throw new Error('Invalid session data')
        }

        // Get the complete archived session data including attendees
        const archivedRef = dbRef(db, `archived-sessions/${session.id}`)
        const snapshot = await get(archivedRef)

        if (!snapshot.exists()) {
          throw new Error('Archived session not found')
        }

        const sessionData = snapshot.val()

        // Create a copy of the session data without the archivedAt property
        // We're using object spread to create a new object, but we need to explicitly omit archivedAt
        const activeSessionData = { ...sessionData }
        delete activeSessionData.archivedAt // Remove the archivedAt property

        // Save to active sessions with all data including attendees
        const activeRef = dbRef(db, `attendance-sessions/${session.id}`)
        await set(activeRef, activeSessionData)

        // Remove from archived sessions
        await remove(archivedRef)

        // Show success message
        toast.success(`Session from ${this.formatDate(session.date)} has been restored.`, {
          position: 'top-center',
          duration: 3000
        })

        // Refresh data
        this.loadSessions()
        this.loadArchivedSessions()

        // If the restored session was being viewed in the modal, close it
        if (this.selectedSession && this.selectedSession.id === session.id) {
          this.closeSessionDetails()
        }
      } catch (error) {
        console.error('Error restoring session:', error)
        toast.error(`Failed to restore session: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      }
    },

    async performDeleteArchivedSession(session) {
      const toast = useToast()
      try {
        if (!session || !session.id || !session.date) {
          throw new Error('Invalid session data')
        }

        // Check if this session is currently active in the QR generator
        const activeSessionRef = dbRef(db, 'active-session')
        const activeSessionSnapshot = await get(activeSessionRef)

        if (activeSessionSnapshot.exists()) {
          const activeSession = activeSessionSnapshot.val()

          // If the active QR session matches the session being deleted, end it
          if (activeSession.sessionId === session.id) {
            console.log('Ending active QR session that matches the deleted session')
            await remove(activeSessionRef)
          }
        }

        // Reference to the archived session
        const archivedRef = dbRef(db, `archived-sessions/${session.id}`)

        // First, get the session data to find all attendees
        const sessionSnapshot = await get(archivedRef)
        if (sessionSnapshot.exists()) {
          const sessionData = sessionSnapshot.val()

          // If the session has attendees, we need to delete their daily attendance records
          // and their user attendance history
          if (sessionData.attendees) {
            // Get all records from daily attendance for this date
            const dailyAttendanceRef = dbRef(db, `daily-attendance/${session.date}`)
            const dailySnapshot = await get(dailyAttendanceRef)

            if (dailySnapshot.exists()) {
              const dailyData = dailySnapshot.val()
              const recordsToDelete = []
              const userAttendanceToDelete = new Map() // Map of userId -> recordIds to delete

              // Find all records that belong to this session
              Object.entries(dailyData).forEach(([recordId, record]) => {
                if (record.sessionId === session.id) {
                  recordsToDelete.push(recordId)

                  // Track which user's attendance history needs to be updated
                  if (record.userId) {
                    if (!userAttendanceToDelete.has(record.userId)) {
                      userAttendanceToDelete.set(record.userId, [])
                    }
                    userAttendanceToDelete.get(record.userId).push(record.timestamp)
                  }
                }
              })

              // Delete each record from daily attendance
              for (const recordId of recordsToDelete) {
                const recordRef = dbRef(db, `daily-attendance/${session.date}/${recordId}`)
                await remove(recordRef)
              }

              console.log(`Deleted ${recordsToDelete.length} daily attendance records for session ${session.id}`)

              // Delete from user attendance history
              for (const [userId, timestamps] of userAttendanceToDelete.entries()) {
                for (const timestamp of timestamps) {
                  const userAttendanceRef = dbRef(db, `user-attendance/${userId}/${session.date}/${timestamp}`)
                  await remove(userAttendanceRef)
                  console.log(`Deleted attendance history for user ${userId} on ${session.date} at ${timestamp}`)
                }

                // Check if this was the user's only attendance record for this date
                // If so, remove the entire date entry
                const userDateRef = dbRef(db, `user-attendance/${userId}/${session.date}`)
                const userDateSnapshot = await get(userDateRef)
                if (!userDateSnapshot.exists() || Object.keys(userDateSnapshot.val()).length === 0) {
                  await remove(userDateRef)
                  console.log(`Removed empty date entry for user ${userId} on ${session.date}`)
                }
              }
            }
          }
        }

        // Delete the archived session
        await remove(archivedRef)

        // Show success message
        toast.success(`Session from ${this.formatDate(session.date)} has been permanently deleted.`, {
          position: 'top-center',
          duration: 3000
        })

        // Refresh archived sessions list
        this.loadArchivedSessions()

        // Also refresh daily attendance if we're on the same date
        if (this.selectedDate === session.date) {
          this.loadDailyAttendance()
        }

        // If the deleted session was being viewed in the modal, close it
        if (this.selectedSession && this.selectedSession.id === session.id) {
          this.closeSessionDetails()
        }
      } catch (error) {
        console.error('Error deleting archived session:', error)
        toast.error(`Failed to delete session: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      }
    },

    selectAllActiveSessions() {
      // Get all session IDs from all month groups
      const allSessionIds = []

      // Loop through all months in the grouped sessions
      Object.values(this.groupedSessions).forEach((monthSessions) => {
        // Add all session IDs from this month to our array
        monthSessions.forEach((session) => {
          allSessionIds.push(session.id)
        })
      })

      // Set all session IDs to the selected array
      this.selectedActiveSessions = allSessionIds
    },

    clearActiveSelection() {
      this.selectedActiveSessions = []
    },

    batchArchiveSessions() {
      const count = this.selectedActiveSessions.length
      this.confirmModalTitle = 'Archive Selected Sessions'
      this.confirmModalMessage = `Are you sure you want to archive ${count} selected session(s)?`
      this.confirmButtonText = 'Archive All Selected'
      this.pendingAction = 'batchArchive'
      this.pendingActionData = [...this.selectedActiveSessions] // Create a copy of the array
      this.showConfirmModal = true
    },

    async performBatchArchiveSessions(sessionIds) {
      const toast = useToast()
      try {
        if (!sessionIds || !sessionIds.length) {
          throw new Error('No sessions selected for archiving')
        }

        // Archive each session one by one
        for (const sessionId of sessionIds) {
          // Find the session data
          const session = this.sessions.find((s) => s.id === sessionId)
          if (!session) continue

          // Add archived timestamp
          const archivedSession = {
            ...session,
            archivedAt: Date.now()
          }

          // Save to archived sessions
          const archivedRef = dbRef(db, `archived-sessions/${sessionId}`)
          await set(archivedRef, archivedSession)

          // Remove from active sessions
          const activeRef = dbRef(db, `attendance-sessions/${sessionId}`)
          await remove(activeRef)
        }

        // Show success message
        toast.success(`${sessionIds.length} sessions have been archived.`, {
          position: 'top-center',
          duration: 3000
        })

        // Clear selection
        this.selectedActiveSessions = []

        // Refresh sessions lists
        this.loadSessions()
        this.loadArchivedSessions()

        // If an archived session was being viewed in the modal, close it
        if (this.selectedSession && sessionIds.includes(this.selectedSession.id)) {
          this.closeSessionDetails()
        }
      } catch (error) {
        console.error('Error batch archiving sessions:', error)
        toast.error(`Failed to archive sessions: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      }
    },

    selectAllArchivedSessions() {
      // Get all session IDs from all month groups
      const allSessionIds = []

      // Loop through all months in the grouped archived sessions
      Object.values(this.groupedArchivedSessions).forEach((monthSessions) => {
        // Add all session IDs from this month to our array
        monthSessions.forEach((session) => {
          allSessionIds.push(session.id)
        })
      })

      // Set all session IDs to the selected array
      this.selectedArchivedSessions = allSessionIds
    },

    clearArchivedSelection() {
      this.selectedArchivedSessions = []
    },

    batchDeleteArchivedSessions() {
      const count = this.selectedArchivedSessions.length
      this.confirmModalTitle = 'Delete Selected Sessions'
      this.confirmModalMessage = `Are you sure you want to permanently delete ${count} selected archived session(s)? This action cannot be undone.`
      this.confirmButtonText = 'Delete All Selected'
      this.pendingAction = 'batchDeleteArchived'
      this.pendingActionData = [...this.selectedArchivedSessions] // Create a copy of the array
      this.showConfirmModal = true
    },

    async performBatchDeleteArchivedSessions(sessionIds) {
      const toast = useToast()
      try {
        if (!sessionIds || !sessionIds.length) {
          throw new Error('No sessions selected for deletion')
        }

        // Check if any of these sessions is currently active in the QR generator
        const activeSessionRef = dbRef(db, 'active-session')
        const activeSessionSnapshot = await get(activeSessionRef)

        if (activeSessionSnapshot.exists()) {
          const activeSession = activeSessionSnapshot.val()

          // If the active QR session is in the list of sessions being deleted, end it
          if (sessionIds.includes(activeSession.sessionId)) {
            console.log('Ending active QR session that matches one of the deleted sessions')
            await remove(activeSessionRef)
          }
        }

        // Get session details for each session ID
        const sessionDetails = []
        for (const sessionId of sessionIds) {
          const sessionRef = dbRef(db, `archived-sessions/${sessionId}`)
          const snapshot = await get(sessionRef)
          if (snapshot.exists()) {
            const sessionData = snapshot.val()
            sessionDetails.push({
              id: sessionId,
              date: sessionData.date,
              attendees: sessionData.attendees
            })
          }
        }

        // Process each session
        for (const session of sessionDetails) {
          // Delete related daily attendance records and user attendance history
          if (session.date && session.attendees) {
            // Get all records from daily attendance for this date
            const dailyAttendanceRef = dbRef(db, `daily-attendance/${session.date}`)
            const dailySnapshot = await get(dailyAttendanceRef)

            if (dailySnapshot.exists()) {
              const dailyData = dailySnapshot.val()
              const recordsToDelete = []
              const userAttendanceToDelete = new Map() // Map of userId -> recordIds to delete

              // Find all records that belong to this session
              Object.entries(dailyData).forEach(([recordId, record]) => {
                if (record.sessionId === session.id) {
                  recordsToDelete.push(recordId)

                  // Track which user's attendance history needs to be updated
                  if (record.userId) {
                    if (!userAttendanceToDelete.has(record.userId)) {
                      userAttendanceToDelete.set(record.userId, [])
                    }
                    userAttendanceToDelete.get(record.userId).push(record.timestamp)
                  }
                }
              })

              // Delete each record from daily attendance
              for (const recordId of recordsToDelete) {
                const recordRef = dbRef(db, `daily-attendance/${session.date}/${recordId}`)
                await remove(recordRef)
              }

              console.log(`Deleted ${recordsToDelete.length} daily attendance records for session ${session.id}`)

              // Delete from user attendance history
              for (const [userId, timestamps] of userAttendanceToDelete.entries()) {
                for (const timestamp of timestamps) {
                  const userAttendanceRef = dbRef(db, `user-attendance/${userId}/${session.date}/${timestamp}`)
                  await remove(userAttendanceRef)
                  console.log(`Deleted attendance history for user ${userId} on ${session.date} at ${timestamp}`)
                }

                // Check if this was the user's only attendance record for this date
                // If so, remove the entire date entry
                const userDateRef = dbRef(db, `user-attendance/${userId}/${session.date}`)
                const userDateSnapshot = await get(userDateRef)
                if (!userDateSnapshot.exists() || Object.keys(userDateSnapshot.val()).length === 0) {
                  await remove(userDateRef)
                  console.log(`Removed empty date entry for user ${userId} on ${session.date}`)
                }
              }
            }
          }

          // Delete the archived session
          const archivedRef = dbRef(db, `archived-sessions/${session.id}`)
          await remove(archivedRef)
        }

        // Show success message
        toast.success(`${sessionIds.length} archived sessions have been permanently deleted.`, {
          position: 'top-center',
          duration: 3000
        })

        // Clear selection
        this.selectedArchivedSessions = []

        // Refresh archived sessions list
        this.loadArchivedSessions()

        // Also refresh daily attendance
        this.loadDailyAttendance()

        // If a deleted session was being viewed in the modal, close it
        if (this.selectedSession && sessionIds.includes(this.selectedSession.id)) {
          this.closeSessionDetails()
        }
      } catch (error) {
        console.error('Error batch deleting archived sessions:', error)
        toast.error(`Failed to delete sessions: ${error.message}`, {
          position: 'top-center',
          duration: 5000
        })
      }
    },

    getTotalSessionCount(groupedData) {
      let count = 0
      // Sum up the length of each month's sessions array
      Object.values(groupedData).forEach((monthSessions) => {
        count += monthSessions.length
      })
      return count
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
    },

    formatDateTime(timestamp) {
      if (!timestamp) return ''
      return new Date(timestamp).toLocaleString()
    },

    getInType(attendee) {
      if (attendee.inType) return attendee.inType
      if (attendee.mixed) return attendee.firstScanDetails.remote ? 'Remote' : 'Office'
      return attendee.remote ? 'Remote' : 'Office'
    },

    getOutType(attendee) {
      if (attendee.outType) return attendee.outType
      if (attendee.mixed && attendee.secondScanDetails) {
        return attendee.secondScanDetails.remote ? 'Remote' : 'Office'
      }
      return attendee.remote ? 'Remote' : 'Office'
    },

    getAttendanceType(attendee) {
      if (attendee.attendanceType) return attendee.attendanceType
      if (attendee.mixed) return 'Mixed'
      return attendee.remote ? 'Remote' : 'Office'
    },

    getInTypeBadgeClass(attendee) {
      const inType = this.getInType(attendee)
      return inType === 'Remote' ? 'remote-mini' : 'office-mini'
    },

    getOutTypeBadgeClass(attendee) {
      const outType = this.getOutType(attendee)
      return outType === 'Remote' ? 'remote-mini' : 'office-mini'
    },

    getAttendanceTypeBadgeClass(attendee) {
      const type = this.getAttendanceType(attendee)
      if (type === 'Mixed') return 'mixed-badge'
      return type === 'Remote' ? 'remote-badge' : 'in-person-badge'
    },

    exportToCSV() {
      if (!this.uniqueAttendees.length) return

      const headers = [
        'No',
        'Email',
        'In Time',
        'In Type',
        'Location In',
        'Map URL In',
        'Out Time',
        'Out Type',
        'Location Out',
        'Map URL Out',
        'Attendance Type',
        'Work Summary'
      ]

      // Use all filtered data, not just the current page
      let csvContent = headers.join(',') + '\n'

      this.filteredData.forEach((attendee, index) => {
        const inType = attendee.mixed
          ? attendee.firstScanDetails.remote
            ? 'Remote'
            : 'Office'
          : attendee.remote
          ? 'Remote'
          : 'Office'
        const outType = attendee.outTime
          ? attendee.mixed
            ? attendee.secondScanDetails.remote
              ? 'Remote'
              : 'Office'
            : attendee.remote
            ? 'Remote'
            : 'Office'
          : ''
        const attendanceType = attendee.mixed ? 'Mixed' : attendee.remote ? 'Remote' : 'Office'

        const row = [
          index + 1,
          attendee.email,
          this.formatTime(attendee.inTime),
          inType,
          attendee.locationIn || 'Office',
          attendee.mapUrlIn || '',
          attendee.outTime ? this.formatTime(attendee.outTime) : 'Pending',
          outType,
          attendee.locationOut || (attendee.outTime ? 'Office' : ''),
          attendee.mapUrlOut || '',
          attendanceType,
          attendee.workSummary || ''
        ]

        // Escape fields that might contain commas
        const escapedRow = row.map((field) => {
          if (field && typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
            return `"${field.replace(/"/g, '""')}"`
          }
          return field
        })

        csvContent += escapedRow.join(',') + '\n'
      })

      this.downloadCSV(csvContent, `Attendance_${this.selectedDate}.csv`)
    },

    exportSessionToCSV() {
      if (!this.sessionAttendees.length || !this.selectedSession) return

      const headers = [
        'No',
        'Email',
        'In Time',
        'In Type',
        'Location In',
        'Map URL In',
        'Out Time',
        'Out Type',
        'Location Out',
        'Map URL Out',
        'Attendance Type',
        'Work Summary'
      ]

      let csvContent = headers.join(',') + '\n'

      // Use filtered modal attendees
      this.filteredModalAttendees.forEach((attendee, index) => {
        const inType = this.getInType(attendee)
        const outType = attendee.outTime ? this.getOutType(attendee) : ''
        const attendanceType = this.getAttendanceType(attendee)

        const row = [
          index + 1,
          attendee.email,
          this.formatTime(attendee.inTime || attendee.timestamp),
          inType,
          attendee.locationIn || (attendee.remote ? attendee.location : 'Office'),
          attendee.mapUrlIn || '',
          attendee.outTime ? this.formatTime(attendee.outTime) : 'Pending',
          outType,
          attendee.locationOut || (attendee.outTime ? 'Office' : ''),
          attendee.mapUrlOut || '',
          attendanceType,
          attendee.workSummary || ''
        ]

        // Escape fields that might contain commas
        const escapedRow = row.map((field) => {
          if (field && typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
            return `"${field.replace(/"/g, '""')}"`
          }
          return field
        })

        csvContent += escapedRow.join(',') + '\n'
      })

      const filename = `Session_${this.selectedSession.date}_${this.selectedSession.type}.csv`
      this.downloadCSV(csvContent, filename)
    },

    downloadCSV(csvContent, filename) {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
}
</script>

<style scoped>
.attendance-list {
  max-width: 1000px;
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

.filters,
.session-filters {
  margin-bottom: 20px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 20px;
}

.date-selector,
.month-selector {
  flex: 1;
  min-width: 250px;
}

.month-select-controls {
  display: flex;
  gap: 10px;
}

.month-select-controls select {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.export-month-btn {
  background-color: #4caf50;
  color: white;
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.export-month-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.session-filters {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 15px;
}

.date-filter {
  position: relative;
}

.clear-filter {
  background: none;
  border: none;
  color: #f44336;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

input[type='date'] {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
  width: 100%;
  max-width: 200px;
}

.table-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.search-box {
  position: relative;
  max-width: 300px;
  width: 100%;
}

.search-box input {
  width: 100%;
  padding: 8px 30px 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.clear-search {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.sortable-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.sortable-table th {
  background-color: #f2f2f2;
  cursor: pointer;
  position: relative;
  padding-right: 25px; /* Space for sort icon */
  user-select: none;
}

.sortable-table th:hover {
  background-color: #e6e6e6;
}

.sortable-table th.sorted {
  background-color: #e3f2fd;
}

.sort-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
}

th.sorted .sort-icon {
  color: #2196f3;
}

th,
td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}

.remote-badge,
.in-person-badge {
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

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-btn {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  color: #333;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.page-btn:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.page-info {
  color: #666;
}

.export-btn {
  background-color: #4caf50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 20px;
}

.no-records {
  padding: 20px;
  text-align: center;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

/* Session List Styles */
.session-list {
  margin-top: 20px;
}

.session-item {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 15px;
  overflow: hidden;
}

.session-item.archived {
  border-left: 4px solid #9e9e9e;
}

.session-header {
  padding: 15px;
  background-color: #f5f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-date {
  font-weight: bold;
}

.session-time {
  color: #666;
  font-size: 0.9em;
}

.session-details {
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.session-type {
  color: #555;
  font-style: italic;
}

.archive-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 0.9em;
}

.archived-badge {
  background-color: #9e9e9e;
  color: white;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.session-actions {
  display: flex;
  gap: 10px;
}

.view-btn {
  background-color: #2196f3;
  padding: 8px 15px;
  font-size: 14px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.archive-btn {
  background-color: #ff9800;
  padding: 8px 15px;
  font-size: 14px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.restore-btn {
  background-color: #9c27b0;
  padding: 8px 15px;
  font-size: 14px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn-session {
  background-color: #f44336;
  padding: 8px 15px;
  font-size: 14px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn-session:hover {
  background-color: #d32f2f;
}

/* For mobile responsiveness */
@media (max-width: 768px) {
  .session-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .view-btn,
  .restore-btn,
  .delete-btn-session {
    flex: 1;
    min-width: 80px;
    text-align: center;
  }
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

.month-header h4 {
  margin: 0;
  color: #333;
  font-size: 1.1em;
}

.session-count {
  background-color: #e0e0e0;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.9em;
  color: #555;
}

.month-sessions {
  padding: 10px;
  background-color: #fff;
  animation: fadeIn 0.3s ease-in-out;
}

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

/* Update session item styling for the new structure */
.month-sessions .session-item {
  margin-bottom: 10px;
}

.month-sessions .session-item:last-child {
  margin-bottom: 0;
}

/* Modal Styles */
.session-details-modal,
.confirmation-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
}

.session-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
}

.summary-item {
  display: flex;
  flex-direction: column;
}

.summary-item .label {
  font-weight: bold;
  color: #666;
  font-size: 0.9em;
}

.summary-item .value {
  font-size: 1.1em;
}

.attendee-search {
  margin-bottom: 15px;
}

.attendee-search input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.confirm-btn {
  background-color: #4caf50;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  background-color: #f44336;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.map-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #2196f3;
  text-decoration: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #e3f2fd;
  transition: background-color 0.2s;
}

.map-link:hover {
  background-color: #bbdefb;
}

.map-icon {
  font-size: 16px;
}

/* Make the table more responsive with the additional columns */
@media (max-width: 1200px) {
  .sortable-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .session-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .session-actions {
    width: 100%;
  }

  .view-btn,
  .archive-btn,
  .restore-btn {
    flex: 1;
    text-align: center;
  }

  .session-summary {
    grid-template-columns: 1fr;
  }
}

.delete-btn {
  background-color: transparent;
  border: none;
  color: #f44336;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.delete-btn:hover {
  background-color: #ffebee;
}

.delete-icon {
  font-size: 16px;
}

/* Make the confirmation modal for deletion more prominent */
.confirmation-modal .modal-content.delete-confirmation {
  border-left: 4px solid #f44336;
}

.confirm-btn.delete-confirm {
  background-color: #f44336;
}

.mixed-badge {
  background-color: #e1f5fe;
  color: #0277bd;
  border: 1px solid rgba(2, 119, 189, 0.2);
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
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
  display: inline-block;
  vertical-align: middle;
}

.remote-mini {
  background-color: #e3f2fd;
  color: #1976d2;
}

.office-mini {
  background-color: #e8f5e9;
  color: #388e3c;
}

.pending-badge {
  background-color: #fff8e1;
  color: #ffa000;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.selection-info {
  font-weight: bold;
  color: #555;
}

.select-all-btn,
.clear-selection-btn {
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
}

.batch-delete-btn {
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  margin-left: auto;
}

.session-select {
  margin-right: 10px;
}

.session-header {
  display: flex;
  align-items: center;
}

.batch-archive-btn {
  background-color: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  margin-left: auto;
}

.batch-archive-btn:hover {
  background-color: #f57c00;
}

.mini-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 5px;
  display: inline-block;
  vertical-align: middle;
}

.remote-mini {
  background-color: #e3f2fd;
  color: #1976d2;
}

.office-mini {
  background-color: #e8f5e9;
  color: #388e3c;
}

/* Make the session details table more compact for the additional columns */
.session-details-modal table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.session-details-modal th,
.session-details-modal td {
  padding: 8px;
  border: 1px solid #ddd;
  text-align: left;
}

.session-details-modal th {
  background-color: #f2f2f2;
  font-weight: bold;
}

.session-details-modal tr:nth-child(even) {
  background-color: #f9f9f9;
}

/* Make the table scrollable horizontally on smaller screens */
@media (max-width: 1200px) {
  .session-details-modal table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
