/**
 * BookingsList — renders upcoming or past bookings with cancel support.
 */
import { format, formatDistanceToNow } from 'date-fns'
import { EmptyState } from '@/components/common/EmptyState'
import { SkeletonCard } from '@/components/common/SkeletonCard'
import { useCancelBooking, useBookings } from '@/features/bookings/hooks/useBookings'
import type { Booking } from '@/lib/schemas'

interface BookingsListProps {
  statusFilter: 'upcoming' | 'past'
}

function BookingCard({ booking }: { booking: Booking }) {
  const { mutate: cancel, isPending } = useCancelBooking()

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-foreground">{booking.session_title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(booking.session_scheduled_at), 'EEE d MMM yyyy · h:mm a')}
          </p>
          <p className="text-sm text-muted-foreground">
            Booked {formatDistanceToNow(new Date(booking.booked_at), { addSuffix: true })}
          </p>
        </div>
        <span className="text-base font-bold">${booking.session_price}</span>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span
          className={[
            'text-xs font-medium px-2 py-1 rounded-full',
            booking.status === 'confirmed'
              ? 'bg-green-100 text-green-700'
              : booking.status === 'cancelled'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground',
          ].join(' ')}
        >
          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </span>

        {booking.status === 'confirmed' && booking.is_upcoming && (
          <button
            onClick={() => cancel(booking.id)}
            disabled={isPending}
            className="text-sm text-destructive hover:underline disabled:opacity-50"
          >
            {isPending ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}

export function BookingsList({ statusFilter }: BookingsListProps) {
  const { data, isLoading, isError } = useBookings(statusFilter)

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
    throw new Error('Failed to load bookings')
  }

  if (!data || data.results.length === 0) {
    return (
      <EmptyState
        title={
          statusFilter === 'upcoming'
            ? 'No upcoming bookings'
            : 'No past bookings'
        }
        description={
          statusFilter === 'upcoming'
            ? 'Browse sessions and book your first one!'
            : 'Your completed and cancelled bookings will appear here.'
        }
      />
    )
  }

  return (
    <div className="space-y-4" data-testid={`${statusFilter}-bookings`}>
      {data.results.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  )
}
