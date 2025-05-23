<template>
  <div class="auto-reset-settings">
    <h2>Automatic Reset Settings</h2>

    <div class="settings-card">
      <div class="form-group">
        <label>Reset Interval:</label>
        <div class="time-input">
          <input type="number" v-model.number="resetHours" min="1" max="24" class="hours-input" />
          <span class="time-label">hours</span>
        </div>
      </div>

      <div class="form-group">
        <label>Reset Time:</label>
        <input type="time" v-model="resetTime" class="time-input" />
      </div>

      <div class="current-settings">
        <h3>Current Settings</h3>
        <p><strong>Reset Interval:</strong> {{ currentSettings.resetHours || 16 }} hours</p>
        <p><strong>Reset Time:</strong> {{ formatTime(currentSettings.resetTime) }}</p>
        <p><strong>Next Reset:</strong> {{ formatDateTime(currentSettings.nextResetTime) }}</p>
      </div>

      <div class="actions">
        <button @click="saveSettings" :disabled="saving" class="save-btn">
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>

      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref as dbRef, get, update } from 'firebase/database'
import { db } from '../firebase/config'

export default {
  name: 'AutoResetSettings',
  data() {
    return {
      resetHours: 16, // Default to 16 hours
      resetTime: '08:00', // Default to 8 AM
      currentSettings: {},
      saving: false,
      message: '',
      messageType: 'info'
    }
  },
  mounted() {
    this.loadCurrentSettings()
  },
  methods: {
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
        this.showMessage('Failed to load settings', 'error')
      }
    },

    async saveSettings() {
      this.saving = true

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

        this.showMessage('Settings saved successfully', 'success')
        this.loadCurrentSettings() // Reload settings
      } catch (error) {
        console.error('Error saving settings:', error)
        this.showMessage('Failed to save settings', 'error')
      } finally {
        this.saving = false
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

    showMessage(text, type = 'info') {
      this.message = text
      this.messageType = type

      setTimeout(() => {
        this.message = ''
        this.messageType = 'info'
      }, 3000)
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
  max-width: 600px;
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

.actions {
  margin-top: 20px;
}

.save-btn {
  background-color: #4caf50;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.save-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
}

.message.success {
  background-color: #dff0d8;
  color: #3c763d;
}

.message.error {
  background-color: #f2dede;
  color: #a94442;
}

.message.info {
  background-color: #d9edf7;
  color: #31708f;
}
</style>
