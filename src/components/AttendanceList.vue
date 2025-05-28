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
        <label for="date-select">Select Date:</label>
        <input type="date" id="date-select" v-model="selectedDate" @change="loadDailyAttendance" />
      </div>

      <div v-if="selectedDate && attendees.length > 0" class="records">
        <h3>Attendance for {{ formatDate(selectedDate) }}</h3>

        <div class="table-controls">
          <div class="record-count">
            <span>Total Attendees: {{ attendees.length }}</span>
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
              <th @click="sortTable('timestamp')" :class="getSortClass('timestamp')">
                Time <span class="sort-icon">{{ getSortIcon('timestamp') }}</span>
              </th>
              <th @click="sortTable('sessionType')" :class="getSortClass('sessionType')">
                Session <span class="sort-icon">{{ getSortIcon('sessionType') }}</span>
              </th>
              <th @click="sortTable('remote')" :class="getSortClass('remote')">
                Type <span class="sort-icon">{{ getSortIcon('remote') }}</span>
              </th>
              <th @click="sortTable('location')" :class="getSortClass('location')">
                Location <span class="sort-icon">{{ getSortIcon('location') }}</span>
              </th>
              <th v-if="hasRemoteAttendees">Map</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(attendee, index) in filteredAttendees" :key="attendee.id">
              <td>{{ index + 1 }}</td>
              <td>{{ attendee.email }}</td>
              <td>{{ formatTime(attendee.timestamp) }}</td>
              <td>{{ getSessionTypeDisplay(attendee.sessionType) }}</td>
              <td>
                <span :class="attendee.remote ? 'remote-badge' : 'in-person-badge'">
                  {{ attendee.remote ? 'Remote' : 'Office' }}
                </span>
              </td>
              <td>{{ attendee.remote ? attendee.location : 'Office' }}</td>
              <td v-if="hasRemoteAttendees">
                <a
                  v-if="attendee.remote && (attendee.mapsUrl || hasCoordinates(attendee))"
                  :href="attendee.mapsUrl || getGoogleMapsUrl(attendee)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="map-link"
                  title="View location on Google Maps"
                >
                  <span class="map-icon">🗺️</span>
                </a>
              </td>
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

        <div class="search-box">
          <input type="text" v-model="sessionSearchQuery" placeholder="Search sessions..." @input="filterSessions" />
          <button @click="sessionSearchQuery = '' && filterSessions()" class="clear-search" v-if="sessionSearchQuery">
            ✕
          </button>
        </div>
      </div>

      <div class="session-list">
        <h3>Active Sessions</h3>

        <div v-if="Object.keys(groupedSessions).length === 0" class="no-records">No active sessions found.</div>

        <div v-else>
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
              <!-- Loop through sessions in this month -->
              <div v-for="session in sessions" :key="session.id" class="session-item">
                <div class="session-header">
                  <div class="session-date">{{ formatDate(session.date) }}</div>
                  <div class="session-time">
                    {{ formatTime(session.startTime) }} - {{ formatTime(session.endTime) }}
                  </div>
                </div>

                <div class="session-details">
                  <div class="session-info">
                    <div class="session-type">{{ getSessionTypeDisplay(session.type) }}</div>
                    <div class="attendee-count">
                      <strong>{{ getAttendeeCount(session) }}</strong> attendees
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

        <div class="search-box">
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
        </div>
      </div>

      <div class="session-list">
        <h3>Archived Sessions</h3>

        <div v-if="Object.keys(groupedArchivedSessions).length === 0" class="no-records">
          No archived sessions found.
        </div>

        <div v-else>
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
              <div v-for="session in sessions" :key="session.id" class="session-item archived">
                <div class="session-header">
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
              <span class="value">{{ sessionAttendees.length }}</span>
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
                <th>Time</th>
                <th>Type</th>
                <th>Location</th>
                <th>Map</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(attendee, index) in filteredModalAttendees" :key="index">
                <td>{{ index + 1 }}</td>
                <td>{{ attendee.email }}</td>
                <td>{{ formatTime(attendee.timestamp) }}</td>
                <td>
                  <span :class="attendee.remote ? 'remote-badge' : 'in-person-badge'">
                    {{ attendee.remote ? 'Remote' : 'Office' }}
                  </span>
                </td>
                <td>{{ attendee.remote ? attendee.location : 'Office' }}</td>
                <td>
                  <a
                    v-if="attendee.remote && (attendee.mapsUrl || hasCoordinates(attendee))"
                    :href="attendee.mapsUrl || getGoogleMapsUrl(attendee)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="map-link"
                    title="View location on Google Maps"
                  >
                    <span class="map-icon">🗺️</span>
                  </a>
                </td>
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

export default {
  name: 'AttendanceList',
  data() {
    return {
      activeTab: 'daily',
      selectedDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      attendees: [],
      sessions: [],
      archivedSessions: [],
      selectedSession: null,
      sessionAttendees: [],

      // Sorting and filtering for daily attendance
      sortKey: 'timestamp',
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
      pendingActionData: null
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
      return this.filteredAttendees.some((attendee) => attendee.remote)
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
      } else if (newTab === 'archived') {
        this.loadArchivedSessions()
      }
    }
  },
  mounted() {
    this.loadDailyAttendance()
    this.loadSessions()
    this.loadArchivedSessions()
  },
  methods: {
    async loadDailyAttendance() {
      if (!this.selectedDate) {
        this.attendees = []
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

          // Initial sort by timestamp
          this.sortTable('timestamp')
          this.filterAttendees()
        } else {
          this.attendees = []
          this.filteredData = []
        }
      })
    },

    loadSessions() {
      const sessionsRef = dbRef(db, 'attendance-sessions')
      onValue(sessionsRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          this.sessions = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key]
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date) || b.startTime - a.startTime)
          this.filterSessions()
        } else {
          this.sessions = []
          this.groupedSessions = {}
        }
      })
    },

    loadArchivedSessions() {
      const archivedRef = dbRef(db, 'archived-sessions')
      onValue(archivedRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          this.archivedSessions = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key]
            }))
            .sort((a, b) => b.archivedAt - a.archivedAt)
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
        if (!this.selectedDate || !attendee || !attendee.id) {
          throw new Error('Missing required information to delete record')
        }

        // Reference to the specific attendance record
        const recordRef = dbRef(db, `daily-attendance/${this.selectedDate}/${attendee.id}`)

        // Also find and remove from user's personal attendance history
        const userRef = dbRef(db, `user-attendance/${attendee.id}/${this.selectedDate}`)

        // Remove the record from daily attendance
        await remove(recordRef)

        // Remove from user's attendance history
        await remove(userRef)

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

      // Group by month
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
        if (key === 'email' || key === 'location' || key === 'sessionType') {
          this.sortOrder = 'asc'
        } else {
          this.sortOrder = 'desc'
        }
      }

      this.filterAttendees()
    },

    filterAttendees() {
      // Filter by search query
      let filtered = this.attendees

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        filtered = filtered.filter(
          (attendee) =>
            (attendee.email && attendee.email.toLowerCase().includes(query)) ||
            (attendee.location && attendee.location.toLowerCase().includes(query))
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
          case 'timestamp':
            comparison = a.timestamp - b.timestamp
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
      if (session.attendees) {
        return Object.keys(session.attendees).length
      }
      return 0
    },

    getSessionTypeDisplay(type) {
      if (type === 'office') {
        return 'Office (07:30 AM - 04:30 PM)'
      } else if (type === 'morning') {
        return 'Morning (07:30 AM - 04:30 PM)'
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
        this.sessionAttendees = Object.keys(snapshot.val())
          .map((userId) => {
            const attendeeData = snapshot.val()[userId]
            return {
              userId,
              ...attendeeData,
              location: attendeeData.location || 'Office', // Ensure location exists

              // Ensure mapsUrl exists if coordinates are available but no mapsUrl
              mapsUrl:
                attendeeData.mapsUrl ||
                (attendeeData.coordinates
                  ? `https://www.google.com/maps?q=${attendeeData.coordinates.latitude},${attendeeData.coordinates.longitude}`
                  : null)
            }
          })
          .sort((a, b) => a.timestamp - b.timestamp)

        // Initialize filtered attendees
        this.filteredModalAttendees = [...this.sessionAttendees]
      } else {
        this.sessionAttendees = []
        this.filteredModalAttendees = []
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

    async confirmAction() {
      if (this.pendingAction === 'archive') {
        await this.performArchiveSession(this.pendingActionData)
      } else if (this.pendingAction === 'restore') {
        await this.performRestoreSession(this.pendingActionData)
      } else if (this.pendingAction === 'deleteAttendance') {
        await this.deleteAttendanceRecord(this.pendingActionData)
      } else if (this.pendingAction === 'removeFromSession') {
        await this.removeAttendeeFromSession(this.pendingActionData)
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
      try {
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

        // Refresh data
        this.loadSessions()
        this.loadArchivedSessions()
      } catch (error) {
        console.error('Error archiving session:', error)
        alert('Failed to archive session: ' + error.message)
      }
    },

    async performRestoreSession(session) {
      try {
        // Remove archived timestamp
        const { ...activeSession } = session

        // Save to active sessions
        const activeRef = dbRef(db, `attendance-sessions/${session.id}`)
        await set(activeRef, activeSession)

        // Remove from archived sessions
        const archivedRef = dbRef(db, `archived-sessions/${session.id}`)
        await remove(archivedRef)

        // Refresh data
        this.loadSessions()
        this.loadArchivedSessions()
      } catch (error) {
        console.error('Error restoring session:', error)
        alert('Failed to restore session: ' + error.message)
      }
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

    exportToCSV() {
      if (!this.attendees.length) return

      const headers = ['No', 'Email', 'Time', 'Session', 'Type', 'Location', 'Maps Link']

      // Use all filtered data, not just the current page
      let csvContent = headers.join(',') + '\n'

      this.filteredData.forEach((attendee, index) => {
        const mapsUrl =
          attendee.remote && (attendee.mapsUrl || this.hasCoordinates(attendee))
            ? attendee.mapsUrl || this.getGoogleMapsUrl(attendee)
            : ''

        const row = [
          index + 1,
          attendee.email,
          this.formatTime(attendee.timestamp),
          this.getSessionTypeDisplay(attendee.sessionType),
          attendee.remote ? 'Remote' : 'Office',
          attendee.remote ? attendee.location : 'Office',
          mapsUrl
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

      const headers = ['No', 'Email', 'Time', 'Type', 'Location', 'Maps Link']

      let csvContent = headers.join(',') + '\n'

      // Use filtered modal attendees
      this.filteredModalAttendees.forEach((attendee, index) => {
        const mapsUrl =
          attendee.remote && (attendee.mapsUrl || this.hasCoordinates(attendee))
            ? attendee.mapsUrl || this.getGoogleMapsUrl(attendee)
            : ''

        const row = [
          index + 1,
          attendee.email,
          this.formatTime(attendee.timestamp),
          attendee.remote ? 'Remote' : 'Office',
          attendee.remote ? attendee.location : 'Office',
          mapsUrl
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
</style>
