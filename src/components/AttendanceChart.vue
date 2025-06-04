<template>
  <div class="chart-container">
    <canvas :key="chartKey" ref="chartCanvas" :class="{ loading: isLoading }"></canvas>
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
    <div v-if="!hasData && !isLoading" class="no-data-message">Not enough data to display this chart</div>
  </div>
</template>

<script>
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

export default {
  name: 'AttendanceChart',
  props: {
    attendanceData: {
      type: Array,
      required: true
    },
    chartType: {
      type: String,
      default: 'monthly'
    }
  },
  data() {
    return {
      chart: null,
      hasData: true,
      chartKey: 0,
      renderTimeout: null,
      isRendering: false,
      isLoading: false,
      isSwitchingChartType: false,
      pendingChartType: null
    }
  },
  watch: {
    attendanceData: {
      handler() {
        this.safeRenderChart()
      },
      deep: true
    },
    chartType(newType) {
      // If already rendering, queue the chart type change
      if (this.isRendering || this.isLoading) {
        console.log('Chart is currently rendering, queueing chart type change to:', newType)
        this.pendingChartType = newType
        return
      }

      // Otherwise, proceed with the chart type change
      this.executeChartTypeChange(newType)
    }
  },
  mounted() {
    this.safeRenderChart()
  },
  beforeUnmount() {
    this.cleanupChart()
    // Clear any pending timeouts
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
    }
  },
  methods: {
    safeRenderChart() {
      // Cancel any pending render
      if (this.renderTimeout) {
        clearTimeout(this.renderTimeout)
      }

      // Clean up existing chart
      this.cleanupChart()

      // Show loading state
      this.isLoading = true

      // Set a timeout to prevent rapid re-renders
      this.renderTimeout = setTimeout(() => {
        this.isRendering = true

        this.$nextTick(() => {
          try {
            this.renderChart()
          } catch (error) {
            console.error('Error rendering chart:', error)
            this.hasData = false
          } finally {
            this.isRendering = false
            this.isLoading = false

            // Check if there's a pending chart type change
            if (this.pendingChartType) {
              const pendingType = this.pendingChartType
              this.pendingChartType = null
              console.log('Processing pending chart type change to:', pendingType)
              this.$nextTick(() => {
                this.executeChartTypeChange(pendingType)
              })
            }
          }
        })
      }, 200) // Increased debounce time for stability
    },

    debouncedRenderChart() {
      // Cancel any pending render
      if (this.renderTimeout) {
        clearTimeout(this.renderTimeout)
      }

      // Clean up existing chart
      this.cleanupChart()

      // Show loading state
      this.isLoading = true

      // Set a timeout to prevent rapid re-renders
      this.renderTimeout = setTimeout(() => {
        if (!this.isRendering) {
          this.isRendering = true
          this.$nextTick(() => {
            try {
              this.renderChart()
            } catch (error) {
              console.error('Error rendering chart:', error)
              this.hasData = false
            } finally {
              this.isRendering = false
              this.isLoading = false
            }
          })
        }
      }, 150) // 150ms debounce time
    },

    executeChartTypeChange(newType) {
      console.log('Executing chart type change to:', newType)
      // Increment key to force canvas recreation
      this.chartKey++

      // Clean up existing chart
      this.cleanupChart()

      // Render new chart on next tick
      this.$nextTick(() => {
        this.safeRenderChart()
      })
    },

    cleanupChart() {
      if (this.chart) {
        try {
          this.chart.destroy()
        } catch (e) {
          console.warn('Error destroying chart:', e)
        }
        this.chart = null
      }
    },

    renderChart() {
      if (!this.$refs.chartCanvas) {
        console.warn('Chart canvas not found')
        return
      }

      // Check if we have enough data to render the chart
      if (this.attendanceData.length === 0) {
        this.hasData = false
        return
      }

      const ctx = this.$refs.chartCanvas.getContext('2d')
      if (!ctx) {
        console.warn('Could not get canvas context')
        return
      }

      // Make sure canvas is clean
      ctx.clearRect(0, 0, this.$refs.chartCanvas.width, this.$refs.chartCanvas.height)

      try {
        if (this.chartType === 'monthly') {
          this.renderMonthlyChart(ctx)
        } else if (this.chartType === 'weekly') {
          this.renderWeeklyChart(ctx)
        } else if (this.chartType === 'distribution') {
          this.renderDistributionChart(ctx)
        } else if (this.chartType === 'streak') {
          this.renderStreakChart(ctx)
        }
        this.hasData = true
      } catch (error) {
        console.error('Error in specific chart render method:', error)
        this.hasData = false
      }
    },

    renderMonthlyChart(ctx) {
      // Group data by month
      const monthlyData = this.groupDataByMonth()

      if (monthlyData.labels.length === 0) {
        this.hasData = false
        return
      }

      const config = {
        type: 'bar',
        data: {
          labels: monthlyData.labels,
          datasets: [
            {
              label: 'Office',
              data: monthlyData.inPersonCounts,
              backgroundColor: 'rgba(56, 142, 60, 0.7)',
              borderColor: 'rgba(56, 142, 60, 1)',
              borderWidth: 1,
              fill: false
            },
            {
              label: 'Remote',
              data: monthlyData.remoteCounts,
              backgroundColor: 'rgba(25, 118, 210, 0.7)',
              borderColor: 'rgba(25, 118, 210, 1)',
              borderWidth: 1,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Monthly Attendance Summary',
              font: {
                size: 16
              }
            },
            legend: {
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return `${context.dataset.label}: ${context.raw} days`
                }
              }
            }
          },
          scales: {
            x: {
              stacked: true,
              title: {
                display: true,
                text: 'Month'
              }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Days'
              },
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      }

      this.chart = new Chart(ctx, config)
    },

    renderWeeklyChart(ctx) {
      try {
        // Group data by day of week
        const weeklyData = this.groupDataByWeekday()

        if (
          weeklyData.labels.length === 0 ||
          (weeklyData.inPersonCounts.every((count) => count === 0) &&
            weeklyData.remoteCounts.every((count) => count === 0))
        ) {
          this.hasData = false
          return
        }

        const config = {
          type: 'radar',
          data: {
            labels: weeklyData.labels,
            datasets: [
              {
                label: 'Office',
                data: weeklyData.inPersonCounts,
                backgroundColor: 'rgba(56, 142, 60, 0.2)',
                borderColor: 'rgba(56, 142, 60, 1)',
                pointBackgroundColor: 'rgba(56, 142, 60, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(56, 142, 60, 1)',
                fill: true
              },
              {
                label: 'Remote',
                data: weeklyData.remoteCounts,
                backgroundColor: 'rgba(25, 118, 210, 0.2)',
                borderColor: 'rgba(25, 118, 210, 1)',
                pointBackgroundColor: 'rgba(25, 118, 210, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(25, 118, 210, 1)',
                fill: true
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Attendance by Day of Week',
                font: {
                  size: 16
                }
              },
              legend: {
                position: 'top'
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `${context.dataset.label}: ${context.raw} days`
                  }
                }
              }
            },
            scales: {
              r: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            }
          }
        }

        this.chart = new Chart(ctx, config)
      } catch (error) {
        console.error('Error rendering weekly chart:', error)
        this.hasData = false
      }
    },

    renderDistributionChart(ctx) {
      // Calculate attendance distribution
      const totalRecords = this.attendanceData.length
      const remoteCount = this.attendanceData.filter((record) => record.remote).length
      const inPersonCount = totalRecords - remoteCount

      const config = {
        type: 'doughnut',
        data: {
          labels: ['Office', 'Remote'],
          datasets: [
            {
              data: [inPersonCount, remoteCount],
              backgroundColor: ['rgba(56, 142, 60, 0.7)', 'rgba(25, 118, 210, 0.7)'],
              borderColor: ['rgba(56, 142, 60, 1)', 'rgba(25, 118, 210, 1)'],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Attendance Distribution',
              font: {
                size: 16
              }
            },
            legend: {
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const percentage = Math.round((context.raw / totalRecords) * 100)
                  return `${context.label}: ${context.raw} days (${percentage}%)`
                }
              }
            }
          }
        }
      }

      this.chart = new Chart(ctx, config)
    },

    renderDistributionChartSplit(ctx) {
      // Calculate attendance distribution with mixed types split
      const totalRecords = this.attendanceData.length

      // Initialize counters
      let pureRemoteCount = 0
      let pureOfficeCount = 0
      let mixedCount = 0

      // Count each type
      this.attendanceData.forEach((record) => {
        if (record.badgeType === 'mixed') {
          mixedCount++
        } else if (record.remote) {
          pureRemoteCount++
        } else {
          pureOfficeCount++
        }
      })

      // Calculate effective counts (split mixed between both categories)
      const effectiveRemoteCount = pureRemoteCount + mixedCount * 0.5
      const effectiveOfficeCount = pureOfficeCount + mixedCount * 0.5

      this.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Office', 'Remote'],
          datasets: [
            {
              data: [effectiveOfficeCount, effectiveRemoteCount],
              backgroundColor: ['rgba(56, 142, 60, 0.7)', 'rgba(25, 118, 210, 0.7)'],
              borderColor: ['rgba(56, 142, 60, 1)', 'rgba(25, 118, 210, 1)'],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Attendance Distribution (Mixed Split)',
              font: {
                size: 16
              }
            },
            legend: {
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const value = context.raw
                  const hasDecimal = value % 1 !== 0
                  const formattedValue = hasDecimal ? value.toFixed(1) : value
                  const percentage = Math.round((value / totalRecords) * 100)
                  return `${context.label}: ${formattedValue} days (${percentage}%)`
                }
              }
            }
          }
        }
      })
    },

    isMixedAttendance(record) {
      return record.badgeType === 'mixed'
    },

    renderStreakChart(ctx) {
      // Calculate attendance streaks
      const streakData = this.calculateStreaks()

      const config = {
        type: 'line',
        data: {
          labels: streakData.labels,
          datasets: [
            {
              label: 'Attendance Streak',
              data: streakData.data,
              backgroundColor: 'rgba(255, 152, 0, 0.2)',
              borderColor: 'rgba(255, 152, 0, 1)',
              borderWidth: 2,
              tension: 0.1,
              fill: false,
              pointRadius: 4,
              pointBackgroundColor: 'rgba(255, 152, 0, 1)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Attendance Streak (Last 30 Days)',
              font: {
                size: 16
              }
            },
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return `${context.raw} consecutive days`
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Streak Days'
              },
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      }

      this.chart = new Chart(ctx, config)
    },

    groupDataByMonth() {
      const months = {}
      const inPersonMonths = {}
      const remoteMonths = {}

      this.attendanceData.forEach((record) => {
        if (!record.date) return // Skip records without date

        try {
          const date = new Date(record.date)
          if (isNaN(date.getTime())) return // Skip invalid dates

          const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' })

          if (!months[monthYear]) {
            months[monthYear] = 0
            inPersonMonths[monthYear] = 0
            remoteMonths[monthYear] = 0
          }

          months[monthYear]++

          // Handle mixed attendance types
          if (record.badgeType === 'mixed') {
            // Count as 0.5 for both categories
            inPersonMonths[monthYear] += 0.5
            remoteMonths[monthYear] += 0.5
          } else if (record.remote) {
            remoteMonths[monthYear]++
          } else {
            inPersonMonths[monthYear]++
          }
        } catch (e) {
          console.error('Error processing date:', record.date, e)
        }
      })

      // Sort months chronologically
      const sortedMonths = Object.keys(months).sort((a, b) => {
        const dateA = new Date(a)
        const dateB = new Date(b)
        return dateA - dateB
      })

      return {
        labels: sortedMonths,
        inPersonCounts: sortedMonths.map((month) => inPersonMonths[month]),
        remoteCounts: sortedMonths.map((month) => remoteMonths[month])
      }
    },

    groupDataByWeekday() {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const inPersonDays = Array(7).fill(0)
      const remoteDays = Array(7).fill(0)

      this.attendanceData.forEach((record) => {
        const date = new Date(record.date)
        const dayOfWeek = date.getDay()

        // Handle mixed attendance types
        if (record.badgeType === 'mixed') {
          // Count as 0.5 for both categories
          inPersonDays[dayOfWeek] += 0.5
          remoteDays[dayOfWeek] += 0.5
        } else if (record.remote) {
          remoteDays[dayOfWeek]++
        } else {
          inPersonDays[dayOfWeek]++
        }
      })

      return {
        labels: weekdays,
        inPersonCounts: inPersonDays,
        remoteCounts: remoteDays
      }
    },

    calculateStreaks() {
      // Sort records by date
      const sortedRecords = [...this.attendanceData].sort((a, b) => new Date(a.date) - new Date(b.date))

      // Get last 30 days of data
      const last30Days = sortedRecords.slice(-30)

      // Calculate streak for each day
      const streakData = []
      let currentStreak = 0

      for (let i = 0; i < last30Days.length; i++) {
        const currentDate = new Date(last30Days[i].date)

        if (i === 0) {
          currentStreak = 1
        } else {
          const prevDate = new Date(last30Days[i - 1].date)
          const dayDiff = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24))

          if (dayDiff === 1) {
            currentStreak++
          } else {
            currentStreak = 1
          }
        }

        streakData.push({
          date: last30Days[i].date,
          streak: currentStreak
        })
      }

      return {
        labels: streakData.map((item) => {
          const date = new Date(item.date)
          return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        }),
        data: streakData.map((item) => item.streak)
      }
    }
  }
}
</script>

<style scoped>
.chart-container {
  height: 300px;
  margin-bottom: 30px;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.no-data-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999;
  font-style: italic;
  text-align: center;
}
</style>
