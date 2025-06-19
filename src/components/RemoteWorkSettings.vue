<template>
  <div class="settings-section">
    <h2>Remote Work Settings</h2>

    <div class="setting-group">
      <h4>Remote Work Availability</h4>
      <p class="setting-description">Control when employees can mark remote attendance</p>

      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.enabledDays.monday" @change="saveSettings" />
          <span>Monday</span>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.enabledDays.tuesday" @change="saveSettings" />
          <span>Tuesday</span>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.enabledDays.wednesday" @change="saveSettings" />
          <span>Wednesday</span>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.enabledDays.thursday" @change="saveSettings" />
          <span>Thursday</span>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.enabledDays.friday" @change="saveSettings" />
          <span>Friday</span>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.enabledDays.saturday" @change="saveSettings" />
          <span>Saturday</span>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" v-model="settings.enabledDays.sunday" @change="saveSettings" />
          <span>Sunday</span>
        </label>
      </div>

      <div class="time-restriction">
        <h4>Time Restrictions</h4>
        <div class="time-inputs">
          <div class="time-input-group">
            <label>Start Time:</label>
            <input type="time" v-model="settings.startTime" @change="saveSettings" />
          </div>

          <div class="time-input-group">
            <label>End Time:</label>
            <input type="time" v-model="settings.endTime" @change="saveSettings" />
          </div>
        </div>
        <p class="setting-note">Remote work attendance can only be marked between these hours on enabled days.</p>
      </div>

      <!-- <div class="setting-row">
        <label class="toggle-switch">
          <input type="checkbox" v-model="settings.requireLocation" @change="saveSettings" />
          <span class="toggle-slider"></span>
        </label>
        <div class="setting-info">
          <div class="setting-name">Require Location</div>
          <div class="setting-description">
            Require employees to enter their location when marking remote attendance
          </div>
        </div>
      </div> -->

      <!-- <div class="setting-row">
        <label class="toggle-switch">
          <input type="checkbox" v-model="settings.limitPerWeek" @change="saveSettings" />
          <span class="toggle-slider"></span>
        </label>
        <div class="setting-info">
          <div class="setting-name">Limit Remote Days Per Week</div>
          <div class="setting-description">Limit the number of days an employee can work remotely per week</div>
        </div>
      </div> -->

      <div class="setting-row" v-if="settings.limitPerWeek">
        <div class="setting-info">
          <div class="setting-name">Maximum Remote Days Per Week</div>
          <input
            type="number"
            v-model.number="settings.maxDaysPerWeek"
            min="1"
            max="7"
            @change="saveSettings"
            class="number-input"
          />
        </div>
      </div>

      <!-- User-specific remote work permissions -->
      <div class="user-permissions">
        <h4>User-Specific Remote Work Permissions</h4>
        <p class="setting-description">
          Grant specific users permission to work remotely regardless of the general settings above
        </p>

        <div class="user-permissions-controls">
          <div class="toggle-row">
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.enableUserSpecificPermissions" @change="saveSettings" />
              <span class="toggle-slider"></span>
            </label>
            <div class="setting-info">
              <div class="setting-name">Enable User-Specific Permissions</div>
              <div class="setting-description">
                When enabled, users in the list below can work remotely regardless of day/time restrictions
              </div>
            </div>
          </div>
        </div>

        <div v-if="settings.enableUserSpecificPermissions" class="user-list-container">
          <div class="user-search">
            <input
              type="text"
              v-model="userSearch"
              placeholder="Search users by name or email..."
              @input="searchUsers"
              class="search-input"
            />
          </div>

          <div class="user-list">
            <div v-if="loading" class="loading-users">
              <div class="spinner"></div>
              <span>Loading users...</span>
            </div>
            <div v-else-if="filteredUsers.length === 0" class="no-users">No users found matching your search.</div>
            <div v-else class="user-items">
              <div v-for="user in filteredUsers" :key="user.id" class="user-item">
                <div class="user-info">
                  <div class="user-name">{{ user.fullName }}</div>
                  <div class="user-email">{{ user.email }}</div>
                </div>
                <div class="user-permission">
                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      :checked="isUserAllowedRemote(user.id)"
                      @change="toggleUserRemotePermission(user)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="settings.allowedRemoteUsers && Object.keys(settings.allowedRemoteUsers).length > 0"
            class="allowed-users-summary"
          >
            <h5>Users with Remote Work Permission ({{ Object.keys(settings.allowedRemoteUsers).length }})</h5>
            <div class="allowed-users-list">
              <div v-for="(allowed, userId) in settings.allowedRemoteUsers" :key="userId" class="allowed-user">
                <span>{{ getUserName(userId) }}</span>
                <button @click="removeUserRemotePermission(userId)" class="remove-btn">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { db } from '../firebase/config'
import { ref as dbRef, get, set } from 'firebase/database'
import { useToast } from 'vue-toastification'

export default {
  name: 'RemoteWorkSettings',
  setup() {
    const toast = useToast()

    return {
      showToast(type, message, options = {}) {
        if (type === 'success') {
          toast.success(message, options)
        } else if (type === 'error') {
          toast.error(message, options)
        } else if (type === 'info') {
          toast.info(message, options)
        } else if (type === 'warning') {
          toast.warning(message, options)
        }
      }
    }
  },
  data() {
    return {
      settings: {
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
        maxDaysPerWeek: 3,
        enableUserSpecificPermissions: false,
        allowedRemoteUsers: {} // userId: true for users allowed to work remotely
      },
      saveTimeout: null,
      users: [], // All users from the database
      filteredUsers: [], // Users filtered by search
      userSearch: '', // Search query for users
      loading: false, // Loading state for users
      userMap: {} // Map of userId to user object for quick lookup
    }
  },
  mounted() {
    this.loadSettings()
  },
  methods: {
    async loadSettings() {
      try {
        const settingsRef = dbRef(db, 'settings/remoteWork')
        const snapshot = await get(settingsRef)

        if (snapshot.exists()) {
          // Merge with defaults to ensure all properties exist
          this.settings = {
            ...this.settings,
            ...snapshot.val()
          }

          // Ensure allowedRemoteUsers exists
          if (!this.settings.allowedRemoteUsers) {
            this.settings.allowedRemoteUsers = {}
          }
        }

        // Load users if user-specific permissions are enabled
        if (this.settings.enableUserSpecificPermissions) {
          this.loadUsers()
        }
      } catch (error) {
        console.error('Error loading remote work settings:', error)
        this.showToast('error', 'Failed to load settings: ' + error.message)
      }
    },

    async saveSettings() {
      try {
        const settingsRef = dbRef(db, 'settings/remoteWork')
        await set(settingsRef, this.settings)
        this.showToast('success', 'Settings saved successfully')

        // Load users if user-specific permissions were just enabled
        if (this.settings.enableUserSpecificPermissions && this.users.length === 0) {
          this.loadUsers()
        }
      } catch (error) {
        console.error('Error saving remote work settings:', error)
        this.showToast('error', 'Failed to save settings: ' + error.message)
      }
    },

    async loadUsers() {
      this.loading = true
      try {
        const usersRef = dbRef(db, 'users')
        const snapshot = await get(usersRef)

        if (snapshot.exists()) {
          const usersData = snapshot.val()
          this.users = Object.keys(usersData).map((uid) => ({
            id: uid,
            ...usersData[uid]
          }))

          // Create a map for quick user lookup
          this.userMap = {}
          this.users.forEach((user) => {
            this.userMap[user.id] = user
          })

          // Initialize filtered users
          this.filteredUsers = [...this.users]
        } else {
          this.users = []
          this.filteredUsers = []
        }
      } catch (error) {
        console.error('Error loading users:', error)
        this.showToast('error', 'Failed to load users: ' + error.message)
      } finally {
        this.loading = false
      }
    },

    searchUsers() {
      if (!this.userSearch.trim()) {
        this.filteredUsers = [...this.users]
        return
      }

      const query = this.userSearch.toLowerCase()
      this.filteredUsers = this.users.filter(
        (user) =>
          (user.fullName && user.fullName.toLowerCase().includes(query)) ||
          (user.email && user.email.toLowerCase().includes(query))
      )
    },

    isUserAllowedRemote(userId) {
      return this.settings.allowedRemoteUsers && this.settings.allowedRemoteUsers[userId] === true
    },

    toggleUserRemotePermission(user) {
      // Initialize if not exists
      if (!this.settings.allowedRemoteUsers) {
        this.settings.allowedRemoteUsers = {}
      }

      // Toggle permission
      if (this.isUserAllowedRemote(user.id)) {
        // Remove permission - Vue 3 way
        const newAllowedUsers = { ...this.settings.allowedRemoteUsers }
        delete newAllowedUsers[user.id]
        this.settings.allowedRemoteUsers = newAllowedUsers

        this.showToast('info', `Remote work permission removed for ${user.fullName}`)
      } else {
        // Add permission - Vue 3 way
        this.settings.allowedRemoteUsers = {
          ...this.settings.allowedRemoteUsers,
          [user.id]: true
        }

        this.showToast('success', `Remote work permission granted to ${user.fullName}`)
      }

      // Save settings
      this.saveSettings()
    },

    removeUserRemotePermission(userId) {
      if (this.settings.allowedRemoteUsers && this.settings.allowedRemoteUsers[userId]) {
        // Get user name for the toast message
        const userName = this.getUserName(userId)

        // Remove permission - Vue 3 way
        const newAllowedUsers = { ...this.settings.allowedRemoteUsers }
        delete newAllowedUsers[userId]
        this.settings.allowedRemoteUsers = newAllowedUsers

        this.showToast('info', `Remote work permission removed for ${userName}`)

        // Save settings
        this.saveSettings()
      }
    },

    getUserName(userId) {
      if (this.userMap[userId]) {
        return this.userMap[userId].fullName || this.userMap[userId].email || 'Unknown User'
      }
      return 'Unknown User'
    }
  }
}
</script>

<style scoped>
.settings-section {
  margin-bottom: 30px;
  padding: 20px;
  position: relative;
}

.setting-group {
  margin-top: 15px;
  background-color: #fff;
  color: #2c3e50;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.setting-group h4{
  margin-top: 0;
}

.setting-description {
  color: #666;
  margin-bottom: 15px;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input {
  margin-right: 8px;
}

.time-restriction {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.time-inputs {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
}

.time-input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.time-input-group label {
  font-weight: bold;
  font-size: 14px;
}

.time-input-group input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
  color: #2c3e50;
}

.setting-note {
  font-size: 14px;
  color: #666;
  font-style: italic;
}

.setting-row,
.toggle-row {
  display: flex;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.setting-row:last-child {
  border-bottom: none;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  margin-right: 15px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #4caf50;
}

input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

.setting-info {
  flex: 1;
}

.setting-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.number-input {
  width: 60px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
}

/* User permissions styles */
.user-permissions {
  margin-top: 30px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.user-permissions h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.user-permissions-controls {
  margin-bottom: 20px;
}

.user-list-container {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
}

.user-search {
  margin-bottom: 15px;
  display: flex;
}

.search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: #fff;
}

.user-list {
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: white;
  max-height: 300px;
  overflow-y: auto;
}

.loading-users,
.no-users {
  padding: 20px;
  text-align: center;
  color: #666;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #4caf50;
  animation: spin 1s linear infinite;
  margin-right: 10px;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}

.user-item:last-child {
  border-bottom: none;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: bold;
  color: #333;
}

.user-email {
  font-size: 0.9em;
  color: #666;
}

.user-permission {
  margin-left: 15px;
}

.allowed-users-summary {
  margin-top: 20px;
}

.allowed-users-summary h5 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1em;
  color: #333;
}

.allowed-users-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.allowed-user {
  display: flex;
  align-items: center;
  background-color: #e3f2fd;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.9em;
  color: #1976d2;
}

.remove-btn {
  background: none;
  border: none;
  color: #f44336;
  cursor: pointer;
  font-size: 14px;
  margin-left: 5px;
  padding: 0 5px;
}

.remove-btn:hover {
  background-color: rgba(244, 67, 54, 0.1);
  border-radius: 50%;
}

@media (max-width: 768px) {
  .time-inputs {
    flex-direction: column;
    gap: 10px;
  }

  .checkbox-group {
    flex-direction: column;
    gap: 5px;
  }

  .user-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .user-permission {
    margin-left: 0;
    margin-top: 10px;
    align-self: flex-end;
  }
}
</style>
