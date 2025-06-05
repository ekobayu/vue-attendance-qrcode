<template>
  <div class="auto-reset-settings">
    <h2>Automatic Reset Settings</h2>

    <div class="settings-card">
      <div class="form-group">
        <label>Reset Interval:</label>
        <div class="time-input">
          <input
            type="number"
            v-model.number="resetHours"
            min="1"
            max="24"
            class="hours-input"
            @change="handleSettingsChange"
          />
          <span class="time-label">hours</span>
        </div>
      </div>

      <div class="form-group">
        <label>Reset Time:</label>
        <input type="time" v-model="resetTime" class="time-input" @change="handleSettingsChange" />
      </div>

      <div class="current-settings">
        <h3>Current Settings</h3>
        <p><strong>Reset Interval:</strong> {{ currentSettings.resetHours || 16 }} hours</p>
        <p><strong>Reset Time:</strong> {{ formatTime(currentSettings.resetTime) }}</p>
        <p><strong>Next Reset:</strong> {{ formatDateTime(currentSettings.nextResetTime) }}</p>
        <p v-if="saving" class="saving-indicator"><span class="spinner"></span> Saving changes...</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref as dbRef, get, update } from 'firebase/database'
import { db } from '../firebase/config'
import { useToast } from 'vue-toastification'

export default {
  name: 'AutoResetSettings',
  data() {
    return {
      resetHours: 16, // Default to 16 hours
      resetTime: '08:00', // Default to 8 AM
      currentSettings: {},
      saving: false,
      toast: null,
      saveTimeout: null
    }
  },
  created() {
    // Initialize toast in created hook
    this.toast = useToast()
  },
  mounted() {
    this.loadCurrentSettings()
  },
  methods: {
    // Helper function to show toast messages
    showToast(type, message, options = {}) {
      const defaultOptions = {
        position: 'top-center',
        timeout: 3000,
        closeOnClick: true,
        pauseOnFocusLoss: true,
        pauseOnHover: true,
        ...options
      }

      if (type === 'success') {
        return this.toast.success(message, defaultOptions)
      } else if (type === 'error') {
        return this.toast.error(message, defaultOptions)
      } else if (type === 'info') {
        return this.toast.info(message, defaultOptions)
      } else if (type === 'warning') {
        return this.toast.warning(message, defaultOptions)
      }
    },

    handleSettingsChange() {
      // Validate inputs
      if (!this.resetHours || this.resetHours < 1 || this.resetHours > 24) {
        this.showToast('error', 'Reset interval must be between 1 and 24 hours')
        return
      }

      if (!this.resetTime) {
        this.showToast('error', 'Please set a valid reset time')
        return
      }

      // Debounce the save operation to avoid too many saves when changing values quickly
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout)
      }

      this.saving = true

      this.saveTimeout = setTimeout(() => {
        this.saveSettings()
      }, 1000) // Wait 1 second before saving
    },

    async loadCurrentSettings() {
      try {
        const settingsRef = dbRef(db, 'settings/autoReset')
        const snapshot = await get(settingsRef)

        if (snapshot.exists()) {
          this.currentSettings = snapshot.val()
          this.resetHours = this.currentSettings.resetHours || 16
          this.resetTime = this.currentSettings.resetTime || '08:00'
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        this.showToast('error', 'Failed to load settings: ' + error.message)
      }
    },

    async saveSettings() {
      if (this.saving) {
        // Already in saving state, continue with the save
        try {
          // Calculate next reset time
          const nextResetTime = this.calculateNextResetTime()

          const settingsRef = dbRef(db, 'settings/autoReset')
          await update(settingsRef, {
            resetHours: this.resetHours,
            resetTime: this.resetTime,
            nextResetTime: nextResetTime,
            updatedAt: Date.now()
          })

          // Update active session if exists
          const activeSessionRef = dbRef(db, 'active-session')
          const activeSnapshot = await get(activeSessionRef)

          if (activeSnapshot.exists()) {
            await update(activeSessionRef, {
              nextResetTime: nextResetTime
            })
          }

          // Show success toast
          this.showToast('success', 'Settings saved automatically', {
            timeout: 2000,
            position: 'bottom-right'
          })

          // Update current settings
          this.currentSettings = {
            ...this.currentSettings,
            resetHours: this.resetHours,
            resetTime: this.resetTime,
            nextResetTime: nextResetTime,
            updatedAt: Date.now()
          }
        } catch (error) {
          console.error('Error saving settings:', error)
          this.showToast('error', 'Failed to save settings: ' + error.message)
        } finally {
          this.saving = false
        }
      }
    },

    calculateNextResetTime() {
      const now = new Date()
      const [hours, minutes] = this.resetTime.split(':').map(Number)

      // Set next reset time to today at specified time
      const nextReset = new Date(now)
      nextReset.setHours(hours, minutes, 0, 0)

      // If that time has already passed today, add specified hours
      if (nextReset <= now) {
        nextReset.setTime(nextReset.getTime() + this.resetHours * 60 * 60 * 1000)
      }

      // If the next reset falls on a weekend, skip to Monday
      const day = nextReset.getDay()
      if (day === 0) {
        // Sunday
        nextReset.setDate(nextReset.getDate() + 1) // Skip to Monday
        nextReset.setHours(hours, minutes, 0, 0) // Reset to the specified time on Monday
      } else if (day === 6) {
        // Saturday
        nextReset.setDate(nextReset.getDate() + 2) // Skip to Monday
        nextReset.setHours(hours, minutes, 0, 0) // Reset to the specified time on Monday
      }

      return nextReset.getTime()
    },

    formatTime(timeString) {
      if (!timeString) return 'Not set'

      // Check if timeString is already a formatted time string (HH:MM)
      if (typeof timeString === 'string' && timeString.includes(':')) {
        // Just return the time string with AM/PM format
        const [hours, minutes] = timeString.split(':').map(Number)
        const date = new Date()
        date.setHours(hours, minutes, 0, 0)
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }

      // If it's a timestamp, convert normally
      return new Date(timeString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    formatDateTime(timestamp) {
      if (!timestamp) return 'Not set'
      return new Date(timestamp).toLocaleString()
    }
  }
}
</script>

<style scoped>
.auto-reset-settings {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.settings-card {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.time-input {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hours-input {
  width: 80px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

input[type='time'] {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 150px;
}

.time-label {
  color: #666;
}

.current-settings {
  margin: 20px 0;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  border-left: 4px solid #2196f3;
}

.current-settings h3 {
  margin-top: 0;
  color: #333;
}

/* Add a spinner for the saving indicator */
.saving-indicator {
  display: flex;
  align-items: center;
  color: #2196f3;
  font-style: italic;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(33, 150, 243, 0.3);
  border-radius: 50%;
  border-top-color: #2196f3;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
