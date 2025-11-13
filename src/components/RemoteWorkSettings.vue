<template>
  <div class="settings-section">
    <h2>Remote Work Settings</h2>

    <!-- Global Settings -->
    <div class="setting-group">
      <h4>Global Remote Work Settings</h4>
      <p class="setting-description">Default settings that apply to all users (unless customized individually)</p>

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
    </div>

    <!-- Individual User Settings -->
    <div class="setting-group">
      <h4>Individual User Remote Work Settings</h4>
      <p class="setting-description">
        Set custom remote work schedules for specific users. Users with custom settings will follow their individual
        schedule instead of the global settings.
      </p>

      <div class="toggle-row">
        <label class="toggle-switch">
          <input type="checkbox" v-model="settings.enableIndividualSettings" @change="saveSettings" />
          <span class="toggle-slider"></span>
        </label>
        <div class="setting-info">
          <div class="setting-name">Enable Individual User Settings</div>
          <div class="setting-description">Allow customizing remote work settings per user</div>
        </div>
      </div>

      <div v-if="settings.enableIndividualSettings" class="user-list-container">
        <!-- Search Users -->
        <div class="user-search">
          <input
            type="text"
            v-model="userSearch"
            placeholder="Search users by name or email..."
            @input="searchUsers"
            class="search-input"
          />
        </div>

        <!-- User List -->
        <div class="user-list">
          <div v-if="loading" class="loading-users">
            <div class="spinner"></div>
            <span>Loading users...</span>
          </div>
          <div v-else-if="filteredUsers.length === 0" class="no-users">No users found matching your search.</div>
          <div v-else class="user-items">
            <div v-for="user in filteredUsers" :key="user.id" class="user-item">
              <div class="user-info">
                <div class="user-name">{{ user.fullName || user.email || 'Unknown User' }}</div>
                <div class="user-email">{{ user.email }}</div>
                <div v-if="hasCustomSettings(user.id)" class="custom-badge">Custom Settings</div>
              </div>
              <div class="user-actions">
                <button @click="editUserSettings(user)" class="btn-edit">
                  {{ hasCustomSettings(user.id) ? 'Edit Settings' : 'Set Custom' }}
                </button>
                <button v-if="hasCustomSettings(user.id)" @click="removeCustomSettings(user.id)" class="btn-remove">
                  Reset to Global
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Users with Custom Settings Summary -->
        <div
          v-if="settings.userCustomSettings && Object.keys(settings.userCustomSettings).length > 0"
          class="custom-settings-summary"
        >
          <h5>Users with Custom Settings ({{ Object.keys(settings.userCustomSettings).length }})</h5>
          <div class="custom-users-list">
            <div v-for="(userSettings, userId) in settings.userCustomSettings" :key="userId" class="custom-user">
              <div class="custom-user-info">
                <span class="custom-user-name">{{ getUserName(userId) }}</span>
                <span class="custom-user-days">{{ getEnabledDaysText(userSettings.enabledDays) }}</span>
                <span class="custom-user-time">{{ userSettings.startTime }} - {{ userSettings.endTime }}</span>
              </div>
              <button @click="editUserSettingsById(userId)" class="btn-edit-small">Edit</button>
              <button @click="removeCustomSettings(userId)" class="btn-remove-small">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit User Settings Modal -->
    <div v-if="showUserSettingsModal && editingUser" class="modal-overlay" @click.self="closeUserSettingsModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Custom Remote Work Settings</h3>
          <button @click="closeUserSettingsModal" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <div class="user-details">
            <div class="user-name">{{ editingUser.fullName || editingUser.email || 'Unknown User' }}</div>
            <div class="user-email">{{ editingUser.email }}</div>
          </div>

          <div class="setting-section">
            <h4>Enabled Days</h4>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="tempUserSettings.enabledDays.monday" />
                <span>Monday</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="tempUserSettings.enabledDays.tuesday" />
                <span>Tuesday</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="tempUserSettings.enabledDays.wednesday" />
                <span>Wednesday</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="tempUserSettings.enabledDays.thursday" />
                <span>Thursday</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="tempUserSettings.enabledDays.friday" />
                <span>Friday</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="tempUserSettings.enabledDays.saturday" />
                <span>Saturday</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="tempUserSettings.enabledDays.sunday" />
                <span>Sunday</span>
              </label>
            </div>
          </div>

          <div class="setting-section">
            <h4>Time Restrictions</h4>
            <div class="time-inputs">
              <div class="time-input-group">
                <label>Start Time:</label>
                <input type="time" v-model="tempUserSettings.startTime" />
              </div>
              <div class="time-input-group">
                <label>End Time:</label>
                <input type="time" v-model="tempUserSettings.endTime" />
              </div>
            </div>
          </div>

          <div class="setting-section">
            <label class="checkbox-label full-width">
              <input type="checkbox" v-model="tempUserSettings.unlimitedAccess" />
              <span>Allow remote work anytime (bypass time restrictions)</span>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeUserSettingsModal" class="btn-cancel">Cancel</button>
          <button @click="saveUserSettings" class="btn-save">Save Settings</button>
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
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        },
        startTime: '07:30',
        endTime: '16:30',
        enableIndividualSettings: false,
        userCustomSettings: {}
      },
      users: [],
      filteredUsers: [],
      userSearch: '',
      loading: false,
      userMap: {},
      showUserSettingsModal: false,
      editingUser: null,
      tempUserSettings: null
    }
  },
  mounted() {
    this.loadSettings()
  },
  methods: {
    // Deep clone helper to avoid reference issues
    deepClone(obj) {
      return JSON.parse(JSON.stringify(obj))
    },

    // Get default user settings template
    getDefaultUserSettings() {
      return {
        enabledDays: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        },
        startTime: '07:30',
        endTime: '16:30',
        unlimitedAccess: false
      }
    },

    async loadSettings() {
      try {
        const settingsRef = dbRef(db, 'settings/remoteWork')
        const snapshot = await get(settingsRef)

        if (snapshot.exists()) {
          const data = snapshot.val()

          // Ensure all nested objects exist
          this.settings = {
            enabledDays: data.enabledDays || this.settings.enabledDays,
            startTime: data.startTime || this.settings.startTime,
            endTime: data.endTime || this.settings.endTime,
            enableIndividualSettings: data.enableIndividualSettings || false,
            userCustomSettings: data.userCustomSettings || {}
          }
        }

        if (this.settings.enableIndividualSettings) {
          await this.loadUsers()
        }
      } catch (error) {
        console.error('Error loading remote work settings:', error)
        this.showToast('error', 'Failed to load settings: ' + error.message)
      }
    },

    async saveSettings() {
      try {
        const settingsRef = dbRef(db, 'settings/remoteWork')

        // Create a clean copy for saving
        const settingsToSave = {
          enabledDays: this.settings.enabledDays,
          startTime: this.settings.startTime,
          endTime: this.settings.endTime,
          enableIndividualSettings: this.settings.enableIndividualSettings,
          userCustomSettings: this.settings.userCustomSettings || {}
        }

        await set(settingsRef, settingsToSave)
        this.showToast('success', 'Settings saved successfully')

        if (this.settings.enableIndividualSettings && this.users.length === 0) {
          await this.loadUsers()
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
          this.users = Object.keys(usersData)
            .map((uid) => ({
              id: uid,
              fullName: usersData[uid].fullName || '',
              email: usersData[uid].email || '',
              ...usersData[uid]
            }))
            .filter((user) => user.email) // Filter out invalid users

          // Create user map for quick lookup
          this.userMap = {}
          this.users.forEach((user) => {
            this.userMap[user.id] = {
              id: user.id,
              fullName: user.fullName,
              email: user.email
            }
          })

          this.filteredUsers = [...this.users]
        } else {
          this.users = []
          this.filteredUsers = []
          this.userMap = {}
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

    hasCustomSettings(userId) {
      return !!(this.settings.userCustomSettings && this.settings.userCustomSettings[userId])
    },

    editUserSettings(user) {
      if (!user || !user.id) {
        console.error('Invalid user object:', user)
        this.showToast('error', 'Invalid user data')
        return
      }

      // Create a clean copy of the user object
      this.editingUser = {
        id: user.id,
        fullName: user.fullName || user.email || 'Unknown User',
        email: user.email || ''
      }

      // Load existing custom settings or use global settings as default
      if (this.hasCustomSettings(user.id)) {
        // Deep clone existing custom settings
        this.tempUserSettings = this.deepClone(this.settings.userCustomSettings[user.id])

        // Ensure all required properties exist
        if (!this.tempUserSettings.enabledDays) {
          this.tempUserSettings.enabledDays = this.deepClone(this.settings.enabledDays)
        }
        if (!this.tempUserSettings.startTime) {
          this.tempUserSettings.startTime = this.settings.startTime
        }
        if (!this.tempUserSettings.endTime) {
          this.tempUserSettings.endTime = this.settings.endTime
        }
        if (this.tempUserSettings.unlimitedAccess === undefined) {
          this.tempUserSettings.unlimitedAccess = false
        }
      } else {
        // Use global settings as template
        this.tempUserSettings = {
          enabledDays: this.deepClone(this.settings.enabledDays),
          startTime: this.settings.startTime,
          endTime: this.settings.endTime,
          unlimitedAccess: false
        }
      }

      this.showUserSettingsModal = true
    },

    editUserSettingsById(userId) {
      const user = this.userMap[userId]
      if (user) {
        this.editUserSettings(user)
      } else {
        console.error('User not found:', userId)
        this.showToast('error', 'User not found')
      }
    },

    closeUserSettingsModal() {
      this.showUserSettingsModal = false
      this.editingUser = null
      this.tempUserSettings = null
    },

    async saveUserSettings() {
      if (!this.editingUser || !this.editingUser.id) {
        this.showToast('error', 'Invalid user data')
        return
      }

      if (!this.tempUserSettings) {
        this.showToast('error', 'No settings to save')
        return
      }

      try {
        // Initialize if needed
        if (!this.settings.userCustomSettings) {
          this.settings.userCustomSettings = {}
        }

        // Create a clean copy of settings to save
        const settingsToSave = this.deepClone(this.tempUserSettings)

        // Update settings with proper reactivity
        this.settings.userCustomSettings = {
          ...this.settings.userCustomSettings,
          [this.editingUser.id]: settingsToSave
        }

        // Save to database
        await this.saveSettings()

        const userName = this.editingUser.fullName || this.editingUser.email
        this.showToast('success', `Custom settings saved for ${userName}`)
        this.closeUserSettingsModal()
      } catch (error) {
        console.error('Error saving user settings:', error)
        this.showToast('error', 'Failed to save user settings: ' + error.message)
      }
    },

    async removeCustomSettings(userId) {
      if (!userId) {
        this.showToast('error', 'Invalid user ID')
        return
      }

      try {
        const userName = this.getUserName(userId)

        if (this.settings.userCustomSettings && this.settings.userCustomSettings[userId]) {
          // Create new object without the user
          const newCustomSettings = { ...this.settings.userCustomSettings }
          delete newCustomSettings[userId]

          // Update with proper reactivity
          this.settings.userCustomSettings = newCustomSettings

          // Save to database
          await this.saveSettings()
          this.showToast('info', `${userName} will now use global remote work settings`)
        }
      } catch (error) {
        console.error('Error removing custom settings:', error)
        this.showToast('error', 'Failed to remove custom settings: ' + error.message)
      }
    },

    getUserName(userId) {
      if (this.userMap[userId]) {
        return this.userMap[userId].fullName || this.userMap[userId].email || 'Unknown User'
      }
      // Check if user exists in custom settings but not in map
      if (this.users.length > 0) {
        const user = this.users.find((u) => u.id === userId)
        if (user) {
          return user.fullName || user.email || 'Unknown User'
        }
      }
      return 'Unknown User'
    },

    getEnabledDaysText(enabledDays) {
      if (!enabledDays) return 'No days enabled'

      const days = []
      if (enabledDays.monday) days.push('Mon')
      if (enabledDays.tuesday) days.push('Tue')
      if (enabledDays.wednesday) days.push('Wed')
      if (enabledDays.thursday) days.push('Thu')
      if (enabledDays.friday) days.push('Fri')
      if (enabledDays.saturday) days.push('Sat')
      if (enabledDays.sunday) days.push('Sun')

      return days.length > 0 ? days.join(', ') : 'No days enabled'
    }
  }
}
</script>

<style scoped>
/* ... (keep all the existing styles) ... */
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

.setting-group h4 {
  margin-top: 0;
  color: #2c3e50;
}

.setting-description {
  color: #666;
  margin-bottom: 15px;
  font-size: 14px;
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

.checkbox-label.full-width {
  width: 100%;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
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

.toggle-row {
  display: flex;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
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

.user-list-container {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
}

.user-search {
  margin-bottom: 15px;
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
  max-height: 400px;
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
  padding: 15px;
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
  margin-bottom: 3px;
}

.user-email {
  font-size: 0.9em;
  color: #666;
}

.custom-badge {
  display: inline-block;
  background-color: #4caf50;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  margin-top: 5px;
}

.user-actions {
  display: flex;
  gap: 10px;
  margin-left: 15px;
}

.btn-edit,
.btn-remove {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-edit {
  background-color: #2196f3;
  color: white;
}

.btn-edit:hover {
  background-color: #1976d2;
}

.btn-remove {
  background-color: #f44336;
  color: white;
}

.btn-remove:hover {
  background-color: #d32f2f;
}

.custom-settings-summary {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.custom-settings-summary h5 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
}

.custom-users-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.custom-user {
  display: flex;
  align-items: center;
  background-color: white;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.custom-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.custom-user-name {
  font-weight: bold;
  color: #333;
}

.custom-user-days {
  font-size: 0.85em;
  color: #2196f3;
}

.custom-user-time {
  font-size: 0.85em;
  color: #666;
}

.btn-edit-small,
.btn-remove-small {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
  transition: all 0.3s;
}

.btn-edit-small {
  background-color: #2196f3;
  color: white;
}

.btn-edit-small:hover {
  background-color: #1976d2;
}

.btn-remove-small {
  background-color: #f44336;
  color: white;
  width: 28px;
  height: 28px;
  padding: 0;
}

.btn-remove-small:hover {
  background-color: #d32f2f;
}

/* Modal Styles */
.modal-overlay {
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
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background-color: #f5f5f5;
}

.modal-body {
  padding: 20px;
}

.user-details {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.user-details .user-name {
  font-weight: bold;
  font-size: 1.1em;
  color: #2c3e50;
  margin-bottom: 5px;
}

.user-details .user-email {
  color: #666;
  font-size: 0.9em;
}

.setting-section {
  margin-bottom: 25px;
}

.setting-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 1em;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #eee;
}

.btn-cancel,
.btn-save {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-cancel {
  background-color: #e0e0e0;
  color: #333;
}

.btn-cancel:hover {
  background-color: #d5d5d5;
}

.btn-save {
  background-color: #4caf50;
  color: white;
}

.btn-save:hover {
  background-color: #45a049;
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

  .user-actions {
    margin-left: 0;
    margin-top: 10px;
    width: 100%;
  }

  .btn-edit,
  .btn-remove {
    flex: 1;
  }

  .modal-content {
    width: 95%;
    max-height: 95vh;
  }

  .custom-user {
    flex-wrap: wrap;
  }

  .custom-user-info {
    width: 100%;
    margin-bottom: 10px;
  }
}
</style>
