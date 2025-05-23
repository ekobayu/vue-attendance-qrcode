<template>
  <div class="settings-section">
    <h3>Remote Work Settings</h3>

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

      <div class="setting-row">
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
      </div>

      <div class="setting-row">
        <label class="toggle-switch">
          <input type="checkbox" v-model="settings.limitPerWeek" @change="saveSettings" />
          <span class="toggle-slider"></span>
        </label>
        <div class="setting-info">
          <div class="setting-name">Limit Remote Days Per Week</div>
          <div class="setting-description">Limit the number of days an employee can work remotely per week</div>
        </div>
      </div>

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
    </div>

    <div class="save-status" v-if="saveStatus">
      <div class="status-message" :class="saveStatus.type">
        {{ saveStatus.message }}
      </div>
    </div>
  </div>
</template>

<script>
import { db } from '../firebase/config'
import { ref as dbRef, get, set } from 'firebase/database'

export default {
  name: 'RemoteWorkSettings',
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
        maxDaysPerWeek: 3
      },
      saveStatus: null,
      saveTimeout: null
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
        }
      } catch (error) {
        console.error('Error loading remote work settings:', error)
        this.showSaveStatus('error', 'Failed to load settings: ' + error.message)
      }
    },

    async saveSettings() {
      try {
        const settingsRef = dbRef(db, 'settings/remoteWork')
        await set(settingsRef, this.settings)

        this.showSaveStatus('success', 'Settings saved successfully')
      } catch (error) {
        console.error('Error saving remote work settings:', error)
        this.showSaveStatus('error', 'Failed to save settings: ' + error.message)
      }
    },

    showSaveStatus(type, message) {
      // Clear any existing timeout
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout)
      }

      // Show status message
      this.saveStatus = { type, message }

      // Clear message after 3 seconds
      this.saveTimeout = setTimeout(() => {
        this.saveStatus = null
      }, 3000)
    }
  }
}
</script>

<style scoped>
.settings-section {
  margin-bottom: 30px;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  position: relative;
}

.setting-group {
  margin-top: 15px;
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
}

.setting-note {
  font-size: 14px;
  color: #666;
  font-style: italic;
}

.setting-row {
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

.save-status {
  position: absolute;
  bottom: 15px;
  right: 15px;
  animation: fadeIn 0.3s ease-out;
}

.status-message {
  padding: 8px 15px;
  border-radius: 4px;
  font-size: 14px;
}

.status-message.success {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-message.error {
  background-color: #ffebee;
  color: #c62828;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

  .checkbox-label {
    width: 100%;
  }
}
</style>
