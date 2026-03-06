import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import './Dashboard.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

// API Response Types
interface ScoreBucket {
  bucket: string
  count: number
}

interface ScoresResponse {
  lab_id: string
  lab_name: string
  buckets: ScoreBucket[]
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface TimelineResponse {
  lab_id: string
  timeline: TimelineEntry[]
}

interface TaskPassRate {
  task_id: string
  task_name: string
  pass_rate: number
  total_submissions: number
  passed_submissions: number
}

interface PassRatesResponse {
  lab_id: string
  tasks: TaskPassRate[]
}

interface Lab {
  id: string
  name: string
}

interface LabsResponse {
  labs: Lab[]
}

type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('api_key')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function fetchWithAuth<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`)
  }
  return response.json() as Promise<T>
}

export default function Dashboard() {
  const [labs, setLabs] = useState<Lab[]>([])
  const [selectedLabId, setSelectedLabId] = useState<string>('')
  const [manualLabId, setManualLabId] = useState<string>('')
  const [labsFetchError, setLabsFetchError] = useState<string | null>(null)
  const [detailedError, setDetailedError] = useState<string | null>(null)

  const [scoresState, setScoresState] = useState<FetchState<ScoresResponse>>({ status: 'idle' })
  const [timelineState, setTimelineState] = useState<FetchState<TimelineResponse>>({ status: 'idle' })
  const [passRatesState, setPassRatesState] = useState<FetchState<PassRatesResponse>>({ status: 'idle' })

  // Fetch available labs on mount
  useEffect(() => {
    const fetchLabs = async () => {
      try {
        console.log('Fetching labs from /analytics/labs')
        const data = await fetchWithAuth<LabsResponse>('/analytics/labs')
        console.log('Labs response:', data)
        setLabs(data.labs)
        if (data.labs.length > 0) {
          setSelectedLabId(data.labs[0].id)
        }
        setLabsFetchError(null)
        setDetailedError(null)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch labs'
        setLabsFetchError(errorMessage)
        setDetailedError(`Failed to fetch labs: ${errorMessage}`)
        console.error('Failed to fetch labs:', error)
      }
    }
    fetchLabs()
  }, [])

  // Fetch dashboard data when lab selection changes
  useEffect(() => {
    if (!selectedLabId) return

    const fetchData = async () => {
      setScoresState({ status: 'loading' })
      setTimelineState({ status: 'loading' })
      setPassRatesState({ status: 'loading' })
      setDetailedError(null)

      try {
        console.log('Fetching dashboard data for lab:', selectedLabId)
        const [scores, timeline, passRates] = await Promise.all([
          fetchWithAuth<ScoresResponse>(`/analytics/scores?lab=${selectedLabId}`),
          fetchWithAuth<TimelineResponse>(`/analytics/timeline?lab=${selectedLabId}`),
          fetchWithAuth<PassRatesResponse>(`/analytics/pass-rates?lab=${selectedLabId}`),
        ])

        console.log('Scores:', scores)
        console.log('Timeline:', timeline)
        console.log('Pass rates:', passRates)

        setScoresState({ status: 'success', data: scores })
        setTimelineState({ status: 'success', data: timeline })
        setPassRatesState({ status: 'success', data: passRates })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setDetailedError(`Dashboard fetch error: ${errorMessage}`)
        console.error('Dashboard fetch error:', error)
        setScoresState({ status: 'error', message: errorMessage })
        setTimelineState({ status: 'error', message: errorMessage })
        setPassRatesState({ status: 'error', message: errorMessage })
      }
    }

    fetchData()
  }, [selectedLabId])

  // Bar chart data for score buckets
  const barChartData = scoresState.status === 'success'
    ? {
        labels: scoresState.data.buckets.map((b) => b.bucket),
        datasets: [
          {
            label: 'Students',
            data: scoresState.data.buckets.map((b) => b.count),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      }
    : { labels: [] as string[], datasets: [] as { label: string; data: number[] }[] }

  // Line chart data for timeline
  const lineChartData = timelineState.status === 'success'
    ? {
        labels: timelineState.data.timeline.map((t) => t.date),
        datasets: [
          {
            label: 'Submissions',
            data: timelineState.data.timeline.map((t) => t.submissions),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            tension: 0.3,
          },
        ],
      }
    : { labels: [] as string[], datasets: [] as { label: string; data: number[] }[] }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  } as const

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <div className="lab-selector">
          {labs.length > 0 ? (
            <>
              <label htmlFor="lab-select">Select Lab:</label>
              <select
                id="lab-select"
                value={selectedLabId}
                onChange={(e) => setSelectedLabId(e.target.value)}
              >
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label htmlFor="manual-lab-input">Lab ID:</label>
              <input
                id="manual-lab-input"
                type="text"
                placeholder="Enter lab ID"
                value={manualLabId}
                onChange={(e) => setManualLabId(e.target.value)}
              />
              <button
                className="load-lab-btn"
                onClick={() => setSelectedLabId(manualLabId)}
                disabled={!manualLabId.trim()}
              >
                Load
              </button>
            </>
          )}
        </div>
      </header>

      {labsFetchError && (
        <div className="labs-error">
          Could not load labs list. Please enter a Lab ID manually.
          {detailedError && <div className="error-details">{detailedError}</div>}
        </div>
      )}

      {(scoresState.status === 'loading' ||
        timelineState.status === 'loading' ||
        passRatesState.status === 'loading') && (
        <div className="loading">Loading dashboard data...</div>
      )}

      {(scoresState.status === 'error' ||
        timelineState.status === 'error' ||
        passRatesState.status === 'error') && (
        <div className="error">
          Error loading dashboard data. Please try again.
          {detailedError && <div className="error-details">{detailedError}</div>}
        </div>
      )}

      <div className="dashboard-content">
        <section className="chart-section">
          <h2>Score Distribution</h2>
          <div className="chart-container">
            {scoresState.status === 'success' && scoresState.data.buckets.length > 0 ? (
              <Bar data={barChartData} options={chartOptions} />
            ) : (
              <p className="no-data">No score data available</p>
            )}
          </div>
        </section>

        <section className="chart-section">
          <h2>Submissions Over Time</h2>
          <div className="chart-container">
            {timelineState.status === 'success' && timelineState.data.timeline.length > 0 ? (
              <Line data={lineChartData} options={chartOptions} />
            ) : (
              <p className="no-data">No timeline data available</p>
            )}
          </div>
        </section>

        <section className="table-section">
          <h2>Pass Rates by Task</h2>
          {passRatesState.status === 'success' && passRatesState.data.tasks.length > 0 ? (
            <table className="pass-rates-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Total Submissions</th>
                  <th>Passed</th>
                  <th>Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {passRatesState.data.tasks.map((task) => (
                  <tr key={task.task_id}>
                    <td>{task.task_name}</td>
                    <td>{task.total_submissions}</td>
                    <td>{task.passed_submissions}</td>
                    <td>
                      <div className="pass-rate-bar">
                        <span>{task.pass_rate.toFixed(1)}%</span>
                        <div
                          className="pass-rate-fill"
                          style={{ width: `${task.pass_rate}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data">No pass rate data available</p>
          )}
        </section>
      </div>
    </div>
  )
}
