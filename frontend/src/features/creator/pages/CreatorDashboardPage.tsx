/**
 * CreatorDashboardPage — session management with react-table, recharts analytics,
 * create/edit/delete dialogs, and toast.loading pattern.
 */
import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { ErrorBoundary } from 'react-error-boundary'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/common/EmptyState'
import { SkeletonCard } from '@/components/common/SkeletonCard'
import { SessionFormDialog } from '@/features/creator/components/SessionFormDialog'
import { SessionsTable } from '@/features/creator/components/SessionsTable'
import {
  useCreatorSessions,
  useDeleteSession,
} from '@/features/creator/hooks/useCreatorSessions'
import type { CreatorSession } from '@/lib/schemas'

/**
 * Read a CSS custom property (e.g. --primary: "240 5.9% 10%") from :root
 * and return it as a valid hsl() string for use in SVG attributes.
 * SVG attributes do NOT resolve CSS custom properties, so we must compute here.
 */
function getCssColor(variable: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const val = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return val ? `hsl(${val})` : fallback
}

// ── Charts ────────────────────────────────────────────────────────────────────
function CreatorCharts({ sessions }: { sessions: CreatorSession[] }) {
  const chartColor = useMemo(() => getCssColor('--primary', '#2563eb'), [])
  // BarChart data: bookings per session (top 8 by title length for readability)
  const bookingsData = sessions.slice(0, 8).map((s) => ({
    name: s.title.length > 20 ? s.title.slice(0, 20) + '…' : s.title,
    bookings: s.booking_count ?? 0,
  }))

  // AreaChart data: revenue per day over the last 30 days
  const revenueData = useMemo(() => {
    const cutoff = subDays(new Date(), 30)
    const byDate: Record<string, number> = {}

    sessions
      .filter((s) => new Date(s.scheduled_at) >= cutoff)
      .forEach((s) => {
        const day = format(new Date(s.scheduled_at), 'MMM d')
        byDate[day] = (byDate[day] ?? 0) + parseFloat(s.price) * (s.booking_count ?? 0)
      })

    return Object.entries(byDate).map(([date, revenue]) => ({ date, revenue }))
  }, [sessions])

  if (sessions.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bookings per session */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Bookings per Session</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bookingsData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="bookings" fill={chartColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue last 30 days */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Revenue (last 30 days)</h3>
        {revenueData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No sessions scheduled in the last 30 days.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={chartColor}
                fill="url(#revenueGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ── Session management ────────────────────────────────────────────────────────
function SessionManagement() {
  const { data, isLoading, isError } = useCreatorSessions()
  const { mutate: deleteSession } = useDeleteSession()
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<CreatorSession | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    throw new Error('Failed to load sessions')
  }

  const sessions = data?.results ?? []

  const totalRevenue = sessions.reduce(
    (sum, s) => sum + parseFloat(s.price) * (s.booking_count ?? 0),
    0,
  )
  const totalBookings = sessions.reduce((sum, s) => sum + (s.booking_count ?? 0), 0)

  function handleEdit(session: CreatorSession) {
    setEditingSession(session)
    setShowForm(true)
  }

  function handleDelete(id: number) {
    setDeleteConfirmId(id)
  }

  function confirmDelete() {
    if (deleteConfirmId !== null) {
      deleteSession(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingSession(null)
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Sessions</p>
          <p className="text-2xl font-bold mt-1">{sessions.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Bookings</p>
          <p className="text-2xl font-bold mt-1">{totalBookings}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold mt-1">${totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Analytics charts */}
      <CreatorCharts sessions={sessions} />

      {/* Session table */}
      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Create your first session to get started."
        />
      ) : (
        <SessionsTable sessions={sessions} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      {/* Create/Edit dialog */}
      {showForm && (
        <SessionFormDialog session={editingSession} onClose={handleCloseForm} />
      )}

      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-background border border-border p-6 shadow-xl mx-4 space-y-4">
            <h2 className="text-lg font-semibold">Delete Session?</h2>
            <p className="text-sm text-muted-foreground">
              This will permanently delete the session and all its bookings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function CreatorDashboardPage() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creator Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your sessions and track analytics.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + New Session
        </button>
      </div>

      <ErrorBoundary
        fallback={
          <div className="space-y-4">
            <EmptyState
              title="Something went wrong"
              description="Could not load your sessions. Please refresh."
            />
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Retry
            </button>
          </div>
        }
      >
        <SessionManagement />
      </ErrorBoundary>

      {showForm && (
        <SessionFormDialog session={null} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
