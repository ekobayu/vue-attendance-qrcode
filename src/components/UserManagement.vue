<template>
  <div class="user-management">
    <h2>User Management</h2>

    <div class="controls-container">
      <div class="search-filter">
        <div class="search-box">
          <input type="text" v-model="searchQuery" placeholder="Search by name or email..." @input="filterUsers" />
          <button @click="searchQuery = '' && filterUsers()" class="clear-search" v-if="searchQuery">✕</button>
        </div>

        <div class="filter-controls">
          <div class="filter-group">
            <label>Role:</label>
            <select v-model="roleFilter" @change="filterUsers">
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="user">Regular Users</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Status:</label>
            <select v-model="statusFilter" @change="filterUsers">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button @click="showAddUserModal = true" class="add-user-btn"><span class="icon">+</span> Add User</button>
        <button @click="exportUsersToCsv" class="export-btn" :disabled="!filteredUsers.length">Export Users</button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading users...</p>
    </div>

    <div v-else-if="!filteredUsers.length" class="no-users">
      <p>No users found matching your criteria.</p>
    </div>

    <div v-else class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th @click="sortUsers('fullName')" :class="getSortClass('fullName')">
              Name <span class="sort-icon">{{ getSortIcon('fullName') }}</span>
            </th>
            <th @click="sortUsers('email')" :class="getSortClass('email')">
              Email <span class="sort-icon">{{ getSortIcon('email') }}</span>
            </th>
            <th @click="sortUsers('role')" :class="getSortClass('role')">
              Role <span class="sort-icon">{{ getSortIcon('role') }}</span>
            </th>
            <th @click="sortUsers('status')" :class="getSortClass('status')">
              Status <span class="sort-icon">{{ getSortIcon('status') }}</span>
            </th>
            <th @click="sortUsers('createdAt')" :class="getSortClass('createdAt')">
              Created <span class="sort-icon">{{ getSortIcon('createdAt') }}</span>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in paginatedUsers" :key="user.id">
            <td>{{ user.fullName }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span :class="user.isAdmin ? 'admin-badge' : 'user-badge'">
                {{ user.isAdmin ? 'Admin' : 'User' }}
              </span>
            </td>
            <td>
              <span :class="getStatusClass(user)">
                {{ getStatusText(user) }}
              </span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td class="actions-cell">
              <button @click="editUser(user)" class="action-btn edit-btn" title="Edit User">
                <span class="icon">✎</span>
              </button>
              <button
                @click="toggleUserStatus(user)"
                class="action-btn"
                :class="user.active ? 'deactivate-btn' : 'activate-btn'"
                :title="user.active ? 'Deactivate User' : 'Activate User'"
              >
                <span class="icon">{{ user.active ? '✕' : '✓' }}</span>
              </button>
              <button
                @click="toggleAdminRole(user)"
                class="action-btn"
                :class="user.isAdmin ? 'remove-admin-btn' : 'make-admin-btn'"
                :title="user.isAdmin ? 'Remove Admin Role' : 'Make Admin'"
              >
                <span class="icon">{{ user.isAdmin ? '↓' : '↑' }}</span>
              </button>
              <button @click="confirmDeleteUser(user)" class="action-btn delete-btn" title="Delete User">
                <span class="icon">🗑</span>
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

        <div class="page-size">
          <label>Users per page:</label>
          <select v-model.number="itemsPerPage" @change="currentPage = 1">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isNewUser ? 'Add New User' : 'Edit User' }}</h3>
          <button @click="closeEditModal" class="close-button">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label for="edit-name">Full Name:</label>
            <input type="text" id="edit-name" v-model="editingUser.fullName" required />
          </div>

          <div class="form-group">
            <label for="edit-email">Email:</label>
            <input type="email" id="edit-email" v-model="editingUser.email" required :disabled="!isNewUser" />
          </div>

          <div class="form-group" v-if="isNewUser">
            <label for="edit-password">Password:</label>
            <div class="password-input-container">
              <input
                :type="showPassword ? 'text' : 'password'"
                id="edit-password"
                v-model="editingUser.password"
                required
              />
              <button type="button" class="toggle-password" @click="showPassword = !showPassword">
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>

          <div class="form-group checkbox-group">
            <input type="checkbox" id="edit-admin" v-model="editingUser.isAdmin" />
            <label for="edit-admin">Administrator Role</label>
          </div>

          <div class="form-group checkbox-group">
            <input type="checkbox" id="edit-active" v-model="editingUser.active" />
            <label for="edit-active">Active Account</label>
          </div>

          <div v-if="editError" class="error-message">{{ editError }}</div>
        </div>

        <div class="modal-footer">
          <button @click="saveUser" class="save-btn" :disabled="saveInProgress">
            {{ saveInProgress ? 'Saving...' : 'Save Changes' }}
          </button>
          <button @click="closeEditModal" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <div v-if="showAddUserModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add New User</h3>
          <button @click="showAddUserModal = false" class="close-button">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label for="new-name">Full Name:</label>
            <input type="text" id="new-name" v-model="newUser.fullName" required />
          </div>

          <div class="form-group">
            <label for="new-email">Email:</label>
            <input type="email" id="new-email" v-model="newUser.email" required />
          </div>

          <div class="form-group">
            <label for="new-password">Password:</label>
            <div class="password-input-container">
              <input
                :type="showNewPassword ? 'text' : 'password'"
                id="new-password"
                v-model="newUser.password"
                required
              />
              <button type="button" class="toggle-password" @click="showNewPassword = !showNewPassword">
                {{ showNewPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>

          <div class="form-group checkbox-group">
            <input type="checkbox" id="new-admin" v-model="newUser.isAdmin" />
            <label for="new-admin">Administrator Role</label>
          </div>

          <div class="form-group checkbox-group">
            <input type="checkbox" id="new-active" v-model="newUser.active" />
            <label for="new-active">Active Account</label>
          </div>

          <div class="form-group checkbox-group">
            <input type="checkbox" id="new-send-email" v-model="newUser.sendEmail" />
            <label for="new-send-email">Send welcome email with login details</label>
          </div>

          <div v-if="addError" class="error-message">{{ addError }}</div>
        </div>

        <div class="modal-footer">
          <button @click="createUser" class="save-btn" :disabled="addInProgress">
            {{ addInProgress ? 'Creating...' : 'Create User' }}
          </button>
          <button @click="showAddUserModal = false" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Confirm Delete</h3>
          <button @click="showDeleteModal = false" class="close-button">&times;</button>
        </div>

        <div class="modal-body">
          <p>
            Are you sure you want to delete the user <strong>{{ userToDelete?.fullName }}</strong
            >?
          </p>
          <p class="warning">
            This action cannot be undone. The user account and all associated attendance records will be permanently
            removed.
          </p>
        </div>

        <div class="modal-footer">
          <button @click="deleteUser" class="delete-confirm-btn" :disabled="deleteInProgress">
            {{ deleteInProgress ? 'Deleting...' : 'Delete User' }}
          </button>
          <button @click="showDeleteModal = false" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Status Change Confirmation Modal -->
    <div v-if="showStatusModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Confirm Status Change</h3>
          <button @click="showStatusModal = false" class="close-button">&times;</button>
        </div>

        <div class="modal-body">
          <p>
            Are you sure you want to
            <strong>{{ userToChangeStatus?.active ? 'deactivate' : 'activate' }}</strong>
            the user <strong>{{ userToChangeStatus?.fullName }}</strong
            >?
          </p>
          <p v-if="userToChangeStatus?.active" class="warning">
            Deactivated users will not be able to log in to the system.
          </p>
        </div>

        <div class="modal-footer">
          <button @click="updateUserStatus" class="confirm-btn" :disabled="statusChangeInProgress">
            {{ statusChangeInProgress ? 'Updating...' : 'Confirm' }}
          </button>
          <button @click="showStatusModal = false" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Role Change Confirmation Modal -->
    <div v-if="showRoleModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Confirm Role Change</h3>
          <button @click="showRoleModal = false" class="close-button">&times;</button>
        </div>

        <div class="modal-body">
          <p>
            Are you sure you want to
            <strong>{{ userToChangeRole?.isAdmin ? 'remove admin privileges from' : 'make admin' }}</strong>
            the user <strong>{{ userToChangeRole?.fullName }}</strong
            >?
          </p>
          <p v-if="!userToChangeRole?.isAdmin" class="warning">
            Administrators have full access to all system features including user management.
          </p>
        </div>

        <div class="modal-footer">
          <button @click="updateUserRole" class="confirm-btn" :disabled="roleChangeInProgress">
            {{ roleChangeInProgress ? 'Updating...' : 'Confirm' }}
          </button>
          <button @click="showRoleModal = false" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { db, auth } from '../firebase/config'
import { ref as dbRef, get, set, remove, update } from 'firebase/database'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'

export default {
  name: 'UserManagement',
  data() {
    return {
      users: [],
      filteredUsers: [],
      loading: true,

      // Sorting and filtering
      searchQuery: '',
      roleFilter: 'all',
      statusFilter: 'all',
      sortKey: 'fullName',
      sortOrder: 'asc',

      // Pagination
      currentPage: 1,
      itemsPerPage: 10,

      // Edit user
      showEditModal: false,
      editingUser: null,
      isNewUser: false,
      editError: '',
      saveInProgress: false,
      showPassword: false,

      // Add user
      showAddUserModal: false,
      newUser: {
        fullName: '',
        email: '',
        password: '',
        isAdmin: false,
        active: true,
        sendEmail: true
      },
      addError: '',
      addInProgress: false,
      showNewPassword: false,

      // Delete user
      showDeleteModal: false,
      userToDelete: null,
      deleteInProgress: false,

      // Status change
      showStatusModal: false,
      userToChangeStatus: null,
      statusChangeInProgress: false,

      // Role change
      showRoleModal: false,
      userToChangeRole: null,
      roleChangeInProgress: false
    }
  },
  computed: {
    paginatedUsers() {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage
      const endIndex = startIndex + this.itemsPerPage
      return this.filteredUsers.slice(startIndex, endIndex)
    },
    totalPages() {
      return Math.ceil(this.filteredUsers.length / this.itemsPerPage)
    }
  },
  mounted() {
    this.loadUsers()
  },
  methods: {
    async loadUsers() {
      this.loading = true

      try {
        const usersRef = dbRef(db, 'users')
        const snapshot = await get(usersRef)

        if (snapshot.exists()) {
          const usersData = snapshot.val()
          this.users = Object.keys(usersData).map((uid) => ({
            id: uid,
            ...usersData[uid],
            active: usersData[uid].active !== false, // Default to true if not specified
            status: this.calculateStatus(usersData[uid])
          }))

          this.filterUsers()
        } else {
          this.users = []
          this.filteredUsers = []
        }
      } catch (error) {
        console.error('Error loading users:', error)
        alert('Failed to load users: ' + error.message)
      } finally {
        this.loading = false
      }
    },

    calculateStatus(user) {
      if (user.active === false) return 'inactive'
      if (user.emailVerified === false) return 'unverified'
      return 'active'
    },

    filterUsers() {
      let filtered = [...this.users]

      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        filtered = filtered.filter(
          (user) =>
            (user.fullName && user.fullName.toLowerCase().includes(query)) ||
            (user.email && user.email.toLowerCase().includes(query))
        )
      }

      // Apply role filter
      if (this.roleFilter !== 'all') {
        filtered = filtered.filter(
          (user) => (this.roleFilter === 'admin' && user.isAdmin) || (this.roleFilter === 'user' && !user.isAdmin)
        )
      }

      // Apply status filter
      if (this.statusFilter !== 'all') {
        filtered = filtered.filter((user) => user.status === this.statusFilter)
      }

      // Apply sorting
      filtered.sort((a, b) => {
        let comparison = 0

        switch (this.sortKey) {
          case 'fullName':
            comparison = (a.fullName || '').localeCompare(b.fullName || '')
            break
          case 'email':
            comparison = (a.email || '').localeCompare(b.email || '')
            break
          case 'role':
            comparison = a.isAdmin === b.isAdmin ? 0 : a.isAdmin ? -1 : 1
            break
          case 'status':
            comparison = (a.status || '').localeCompare(b.status || '')
            break
          case 'createdAt':
            comparison = (a.createdAt || 0) - (b.createdAt || 0)
            break
          default:
            comparison = 0
        }

        return this.sortOrder === 'asc' ? comparison : -comparison
      })

      this.filteredUsers = filtered

      // Reset to first page when filters change
      this.currentPage = 1
    },

    sortUsers(key) {
      if (this.sortKey === key) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortKey = key
        this.sortOrder = 'asc'
      }

      this.filterUsers()
    },

    getSortClass(key) {
      return this.sortKey === key ? `sorted ${this.sortOrder}` : ''
    },

    getSortIcon(key) {
      if (this.sortKey !== key) return '⇅'
      return this.sortOrder === 'asc' ? '↑' : '↓'
    },

    getStatusClass(user) {
      if (user.active === false) return 'inactive-badge'
      if (user.emailVerified === false) return 'unverified-badge'
      return 'active-badge'
    },

    getStatusText(user) {
      if (user.active === false) return 'Inactive'
      if (user.emailVerified === false) return 'Unverified'
      return 'Active'
    },

    editUser(user) {
      this.editingUser = { ...user }
      this.isNewUser = false
      this.showEditModal = true
      this.editError = ''
    },

    closeEditModal() {
      this.showEditModal = false
      this.editingUser = null
      this.editError = ''
    },

    async saveUser() {
      if (!this.editingUser.fullName || !this.editingUser.email) {
        this.editError = 'Name and email are required'
        return
      }

      this.saveInProgress = true

      try {
        const userRef = dbRef(db, `users/${this.editingUser.id}`)

        // Only update allowed fields
        const updates = {
          fullName: this.editingUser.fullName,
          isAdmin: this.editingUser.isAdmin,
          active: this.editingUser.active
        }

        await update(userRef, updates)

        // Refresh user list
        await this.loadUsers()

        this.closeEditModal()
      } catch (error) {
        console.error('Error updating user:', error)
        this.editError = 'Failed to update user: ' + error.message
      } finally {
        this.saveInProgress = false
      }
    },

    async createUser() {
      if (!this.newUser.fullName || !this.newUser.email || !this.newUser.password) {
        this.addError = 'Name, email and password are required'
        return
      }

      this.addInProgress = true

      try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, this.newUser.email, this.newUser.password)

        const user = userCredential.user

        // Save user data to database
        const userRef = dbRef(db, `users/${user.uid}`)
        await set(userRef, {
          fullName: this.newUser.fullName,
          email: this.newUser.email,
          createdAt: Date.now(),
          isAdmin: this.newUser.isAdmin,
          active: this.newUser.active,
          emailVerified: false
        })

        // Send welcome email if selected
        if (this.newUser.sendEmail) {
          await sendPasswordResetEmail(auth, this.newUser.email)
        }

        // Refresh user list
        await this.loadUsers()

        // Reset form and close modal
        this.newUser = {
          fullName: '',
          email: '',
          password: '',
          isAdmin: false,
          active: true,
          sendEmail: true
        }

        this.showAddUserModal = false
      } catch (error) {
        console.error('Error creating user:', error)

        // Handle specific Firebase errors
        switch (error.code) {
          case 'auth/email-already-in-use':
            this.addError = 'This email address is already in use.'
            break
          case 'auth/invalid-email':
            this.addError = 'The email address is not valid.'
            break
          case 'auth/weak-password':
            this.addError = 'The password is too weak.'
            break
          default:
            this.addError = 'Failed to create user: ' + error.message
        }
      } finally {
        this.addInProgress = false
      }
    },

    showToast(type, message, options = {}) {
      if (this.$toast) {
        if (type === 'success') {
          this.$toast.success(message, options)
        } else if (type === 'error') {
          this.$toast.error(message, options)
        } else if (type === 'info') {
          this.$toast.info(message, options)
        } else if (type === 'warning') {
          this.$toast.warning(message, options)
        }
      } else {
        // Fallback to alert if toast is not available
        alert(message)
      }
    },

    confirmDeleteUser(user) {
      this.userToDelete = user
      this.showDeleteModal = true
    },

    async deleteUser() {
      if (!this.userToDelete) return

      this.deleteInProgress = true

      try {
        const userId = this.userToDelete.id
        const userEmail = this.userToDelete.email

        // Show loading toast
        this.showToast('info', `Deleting user ${userEmail} and all associated data...`, {
          timeout: false // Don't auto-close
        })

        // 1. Delete user's attendance records from daily-attendance
        // First, we need to find all dates where this user has attendance
        const dailyAttendanceRef = dbRef(db, 'daily-attendance')
        const dailySnapshot = await get(dailyAttendanceRef)

        if (dailySnapshot.exists()) {
          const dailyData = dailySnapshot.val()
          const deletePromises = []

          // Loop through each date
          for (const date in dailyData) {
            // Check if this user has an entry for this date
            if (dailyData[date] && dailyData[date][userId]) {
              const recordRef = dbRef(db, `daily-attendance/${date}/${userId}`)
              deletePromises.push(remove(recordRef))
            }
          }

          // Wait for all daily attendance records to be deleted
          if (deletePromises.length > 0) {
            await Promise.all(deletePromises)
          }
        }

        // 2. Delete user's personal attendance history
        const userAttendanceRef = dbRef(db, `user-attendance/${userId}`)
        await remove(userAttendanceRef)

        // 3. Delete user from session attendees
        // First active sessions
        const activeSessionsRef = dbRef(db, 'attendance-sessions')
        const activeSessionsSnapshot = await get(activeSessionsRef)

        if (activeSessionsSnapshot.exists()) {
          const activeSessions = activeSessionsSnapshot.val()
          const sessionPromises = []

          // Loop through each session
          for (const sessionId in activeSessions) {
            if (activeSessions[sessionId].attendees && activeSessions[sessionId].attendees[userId]) {
              const attendeeRef = dbRef(db, `attendance-sessions/${sessionId}/attendees/${userId}`)
              sessionPromises.push(remove(attendeeRef))
            }
          }

          // Wait for all session attendee records to be deleted
          if (sessionPromises.length > 0) {
            await Promise.all(sessionPromises)
          }
        }

        // Then archived sessions
        const archivedSessionsRef = dbRef(db, 'archived-sessions')
        const archivedSessionsSnapshot = await get(archivedSessionsRef)

        if (archivedSessionsSnapshot.exists()) {
          const archivedSessions = archivedSessionsSnapshot.val()
          const archivedPromises = []

          // Loop through each archived session
          for (const sessionId in archivedSessions) {
            if (archivedSessions[sessionId].attendees && archivedSessions[sessionId].attendees[userId]) {
              const attendeeRef = dbRef(db, `archived-sessions/${sessionId}/attendees/${userId}`)
              archivedPromises.push(remove(attendeeRef))
            }
          }

          // Wait for all archived session attendee records to be deleted
          if (archivedPromises.length > 0) {
            await Promise.all(archivedPromises)
          }
        }

        // 4. Finally, delete the user data from users collection
        const userRef = dbRef(db, `users/${userId}`)
        await remove(userRef)

        // Show success toast
        this.showToast('success', `User ${userEmail} and all associated data have been deleted successfully`)

        // Refresh user list
        await this.loadUsers()

        this.showDeleteModal = false
        this.userToDelete = null
      } catch (error) {
        console.error('Error deleting user:', error)
        this.showToast('error', `Failed to delete user: ${error.message}`)
      } finally {
        this.deleteInProgress = false
      }
    },

    toggleUserStatus(user) {
      this.userToChangeStatus = user
      this.showStatusModal = true
    },

    async updateUserStatus() {
      if (!this.userToChangeStatus) return

      this.statusChangeInProgress = true

      try {
        const userRef = dbRef(db, `users/${this.userToChangeStatus.id}`)

        // Toggle active status
        await update(userRef, {
          active: !this.userToChangeStatus.active
        })

        // Refresh user list
        await this.loadUsers()

        this.showStatusModal = false
        this.userToChangeStatus = null
      } catch (error) {
        console.error('Error updating user status:', error)
        alert('Failed to update user status: ' + error.message)
      } finally {
        this.statusChangeInProgress = false
      }
    },

    toggleAdminRole(user) {
      this.userToChangeRole = user
      this.showRoleModal = true
    },

    async updateUserRole() {
      if (!this.userToChangeRole) return

      this.roleChangeInProgress = true

      try {
        const userRef = dbRef(db, `users/${this.userToChangeRole.id}`)

        // Toggle admin role
        await update(userRef, {
          isAdmin: !this.userToChangeRole.isAdmin
        })

        // Refresh user list
        await this.loadUsers()

        this.showRoleModal = false
        this.userToChangeRole = null
      } catch (error) {
        console.error('Error updating user role:', error)
        alert('Failed to update user role: ' + error.message)
      } finally {
        this.roleChangeInProgress = false
      }
    },

    formatDate(timestamp) {
      if (!timestamp) return 'N/A'
      return new Date(timestamp).toLocaleDateString()
    },

    exportUsersToCsv() {
      if (!this.filteredUsers.length) return

      const headers = ['Name', 'Email', 'Role', 'Status', 'Created Date']

      let csvContent = headers.join(',') + '\n'

      this.filteredUsers.forEach((user) => {
        const row = [
          user.fullName || '',
          user.email || '',
          user.isAdmin ? 'Admin' : 'User',
          this.getStatusText(user),
          this.formatDate(user.createdAt)
        ]

        // Escape fields that might contain commas
        const escapedRow = row.map((field) => {
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`
          }
          return field
        })

        csvContent += escapedRow.join(',') + '\n'
      })

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', 'users.csv')
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
}
</script>

<style scoped>
.user-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h2 {
  margin-bottom: 30px;
  color: #333;
}

.controls-container {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.search-filter {
  display: flex;
  flex-direction: column;
  gap: 15px;
  flex: 1;
}

.search-box {
  position: relative;
  max-width: 400px;
}

.search-box input {
  width: 100%;
  padding: 10px 30px 10px 10px;
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
  padding: 0;
}

.filter-controls {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-weight: bold;
  margin: 0;
}

.filter-group select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.add-user-btn {
  background-color: #4caf50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.export-btn {
  background-color: #2196f3;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.export-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 0;
}

.loading-spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 2s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.no-users {
  text-align: center;
  padding: 30px;
  background-color: #f9f9f9;
  border-radius: 8px;
  color: #666;
}

.users-table-container {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.users-table th {
  background-color: #f2f2f2;
  cursor: pointer;
  position: relative;
  padding-right: 25px;
  user-select: none;
}

.users-table th:hover {
  background-color: #e6e6e6;
}

.users-table th.sorted {
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

.users-table th,
.users-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.users-table tbody tr:hover {
  background-color: #f5f5f5;
}

.admin-badge,
.user-badge,
.active-badge,
.inactive-badge,
.unverified-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.admin-badge {
  background-color: #e3f2fd;
  color: #1976d2;
}

.user-badge {
  background-color: #f5f5f5;
  color: #757575;
}

.active-badge {
  background-color: #e8f5e9;
  color: #388e3c;
}

.inactive-badge {
  background-color: #ffebee;
  color: #d32f2f;
}

.unverified-badge {
  background-color: #fff8e1;
  color: #ffa000;
}

.actions-cell {
  white-space: nowrap;
  text-align: center;
}

.action-btn {
  background-color: transparent;
  border: none;
  cursor: pointer;
  padding: 5px;
  margin: 0 2px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: #f0f0f0;
}

.edit-btn {
  color: #2196f3;
}

.delete-btn {
  color: #f44336;
}

.activate-btn {
  color: #4caf50;
}

.deactivate-btn {
  color: #f44336;
}

.make-admin-btn {
  color: #9c27b0;
}

.remove-admin-btn {
  color: #ff9800;
}

.icon {
  font-size: 18px;
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

.page-size {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-size select {
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* Modal Styles */
.modal {
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
  max-width: 500px;
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

.form-group {
  margin-bottom: 15px;
  max-width: 430px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.form-group input[type='text'],
.form-group input[type='email'],
.form-group input[type='password'] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.checkbox-group label {
  margin-bottom: 0;
  font-weight: normal;
}

.password-input-container {
  position: relative;
}

.toggle-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
}

.error-message {
  color: #f44336;
  margin-top: 15px;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
}

.modal-footer {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.save-btn,
.confirm-btn {
  background-color: #4caf50;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:disabled,
.confirm-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.cancel-btn {
  background-color: #f44336;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-confirm-btn {
  background-color: #f44336;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-confirm-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.warning {
  color: #f44336;
  font-style: italic;
}

@media (max-width: 768px) {
  .controls-container {
    flex-direction: column;
  }

  .action-buttons {
    width: 100%;
  }

  .add-user-btn,
  .export-btn {
    flex: 1;
    justify-content: center;
  }

  .actions-cell {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
