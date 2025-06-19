<template>
  <div class="early-bird-page">
    <h1>Early Bird Check-ins</h1>
    <div class="page-description">
      <p>Showing employees who checked in before 8:00 AM today.</p>
      <div class="current-date">{{ formatDate(today) }}</div>
    </div>

    <div class="early-bird-container">
      <div v-if="loading" class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading early check-ins...</p>
      </div>

      <div v-else-if="earlyBirdUsers.length > 0" class="early-bird-list">
        <table class="early-bird-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Email</th>
              <th>Check-in Time</th>
              <th>Type</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(user, index) in earlyBirdUsers" :key="index">
              <td class="rank-cell" :class="getRankClass(index)">{{ index + 1 }}</td>
              <td>{{ user.email }}</td>
              <td>{{ formatTime(user.timestamp) }}</td>
              <td>
                <span :class="user.remote ? 'remote-badge' : 'in-person-badge'">
                  {{ user.remote ? 'Remote' : 'Office' }}
                </span>
              </td>
              <td class="location-cell">
                <span>{{ user.location || 'Office' }}</span>
                <a
                  v-if="user.remote && getMapUrl(user)"
                  :href="getMapUrl(user)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="map-link"
                  title="View location on Google Maps"
                >
                  <span class="map-icon">🗺️</span>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="no-records">
        <div class="no-records-icon">🌅</div>
        <p>No early check-ins found for today.</p>
        <p class="sub-text">Early birds are employees who check in before 8:00 AM.</p>
      </div>
    </div>

    <div class="actions">
      <!-- <router-link to="/attendance" class="back-btn">Back to Attendance Records</router-link> -->
      <button @click="refreshData" class="refresh-btn"><span class="refresh-icon">🔄</span> Refresh Data</button>
    </div>
  </div>
</template>

<script>
import { db } from '../firebase/config'
import { ref as dbRef, get } from 'firebase/database'
import { getTodayDateString } from '@/services/getTodayDateString'

export default {
  name: 'EarlyBirdPage',
  data() {
    return {
      earlyBirdUsers: [],
      loading: true,
      today: getTodayDateString()
    }
  },
  mounted() {
    this.loadEarlyBirdData()
  },
  methods: {
    async loadEarlyBirdData() {
      this.loading = true
      try {
        // Early check-in cutoff time (8 AM)
        const cutoffHour = 8
        const earlyCheckIns = []

        // Get today's date
        const today = this.today

        // Fetch today's attendance records
        const dailyRef = dbRef(db, `daily-attendance/${today}`)
        const snapshot = await get(dailyRef)

        if (snapshot.exists()) {
          const records = snapshot.val()

          // Process each record for today
          Object.values(records).forEach((record) => {
            if (!record.timestamp) return

            const checkInTime = new Date(record.timestamp)
            const checkInHour = checkInTime.getHours()

            // Check if this is an early check-in (before 8 AM)
            if (checkInHour < cutoffHour) {
              earlyCheckIns.push({
                ...record,
                date: today,
                checkInHour,
                checkInMinute: checkInTime.getMinutes()
              })
            }
          })

          // Group by user (to avoid duplicates) and take the earliest check-in for each user
          const userMap = new Map()
          earlyCheckIns.forEach((record) => {
            if (!record.userId) return

            if (!userMap.has(record.userId) || record.timestamp < userMap.get(record.userId).timestamp) {
              userMap.set(record.userId, record)
            }
          })

          // Convert map to array and sort by check-in time (earliest first)
          const uniqueEarlyCheckIns = Array.from(userMap.values())
          uniqueEarlyCheckIns.sort((a, b) => a.timestamp - b.timestamp)

          this.earlyBirdUsers = uniqueEarlyCheckIns
        }
      } catch (error) {
        console.error('Error loading early bird data:', error)
      } finally {
        this.loading = false
      }
    },

    refreshData() {
      this.loadEarlyBirdData()
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

    getRankClass(index) {
      if (index === 0) return 'gold'
      if (index === 1) return 'silver'
      if (index === 2) return 'bronze'
      return ''
    },

    getMapUrl(user) {
      if (!user.remote) return null

      // If the user has a direct mapsUrl, use it
      if (user.mapsUrl) {
        return user.mapsUrl
      }

      // Otherwise, try to construct a URL from coordinates
      if (user.coordinates && user.coordinates.latitude && user.coordinates.longitude) {
        return `https://www.google.com/maps?q=${user.coordinates.latitude},${user.coordinates.longitude}`
      }

      return null
    }
  }
}
</script>

<style scoped>
.early-bird-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #2e7d32;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

h1::before {
  content: '🌅';
  margin-right: 10px;
  font-size: 1.2em;
}

.page-description {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 15px;
}

.current-date {
  font-weight: bold;
  color: #333;
  background-color: #f5f5f5;
  padding: 8px 15px;
  border-radius: 20px;
  font-size: 0.9em;
}

.early-bird-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 30px;
  color: #2c3e50;
}

.early-bird-table {
  width: 100%;
  border-collapse: collapse;
}

.early-bird-table th {
  background-color: #e8f5e9;
  color: #2e7d32;
  font-weight: bold;
  text-align: left;
  padding: 15px;
  border-bottom: 2px solid #c8e6c9;
}

.early-bird-table td {
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.early-bird-table tr:last-child td {
  border-bottom: none;
}

.early-bird-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.early-bird-table tr:hover {
  background-color: #f1f8e9;
}

.rank-cell {
  font-weight: bold;
  text-align: center;
  width: 60px;
}

.rank-cell.gold {
  background-color: #fff9c4;
  color: #ff6f00;
  position: relative;
}

.rank-cell.gold::before {
  content: '🥇';
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
}

.rank-cell.silver {
  background-color: #f5f5f5;
  color: #757575;
  position: relative;
}

.rank-cell.silver::before {
  content: '🥈';
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
}

.rank-cell.bronze {
  background-color: #ffe0b2;
  color: #8d6e63;
  position: relative;
}

.rank-cell.bronze::before {
  content: '🥉';
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
}

.remote-badge,
.in-person-badge {
  display: inline-block;
  padding: 4px 10px;
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

.location-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.map-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #2196f3;
  text-decoration: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #e3f2fd;
  transition: background-color 0.2s;
}

.map-link:hover {
  background-color: #bbdefb;
}

.map-icon {
  font-size: 14px;
}

.no-records {
  padding: 60px 20px;
  text-align: center;
  color: #666;
}

.no-records-icon {
  font-size: 48px;
  margin-bottom: 20px;
  opacity: 0.7;
}

.sub-text {
  font-size: 0.9em;
  color: #999;
  margin-top: 10px;
}

.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.back-btn {
  background-color: #f5f5f5;
  color: #333;
  padding: 10px 20px;
  border-radius: 4px;
  text-decoration: none;
  border: 1px solid #ddd;
  transition: background-color 0.2s;
}

.back-btn:hover {
  background-color: #e0e0e0;
}

.refresh-btn {
  background-color: #4caf50;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.refresh-btn:hover {
  background-color: #43a047;
}

.refresh-icon {
  font-size: 16px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #4caf50;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .page-description {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .early-bird-table {
    font-size: 0.9em;
  }

  .early-bird-table th,
  .early-bird-table td {
    padding: 10px;
  }

  .actions {
    flex-direction: column;
    gap: 10px;
  }

  .back-btn,
  .refresh-btn {
    width: 100%;
    text-align: center;
    justify-content: center;
  }
}
</style>
