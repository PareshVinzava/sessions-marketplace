/**
 * UserDashboardPage — tabs: upcoming bookings / past bookings.
 * Profile is a separate page at /profile.
 */
import { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { EmptyState } from '@/components/common/EmptyState'
import { BookingsList } from '@/features/bookings/components/BookingsList'

type Tab = 'upcoming' | 'past'

export function UserDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight mb-8">My Bookings</h1>

      {/* Tab bar */}
      <div className="border-b border-border mb-8">
        <nav className="flex gap-6" aria-label="Dashboard tabs">
          {(
            [
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'past', label: 'Past' },
            ] satisfies { id: Tab; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'upcoming' && (
        <ErrorBoundary
          fallback={<EmptyState title="Could not load bookings" description="Please try refreshing." />}
        >
          <BookingsList statusFilter="upcoming" />
        </ErrorBoundary>
      )}
      {activeTab === 'past' && (
        <ErrorBoundary
          fallback={<EmptyState title="Could not load bookings" description="Please try refreshing." />}
        >
          <BookingsList statusFilter="past" />
        </ErrorBoundary>
      )}
    </div>
  )
}
