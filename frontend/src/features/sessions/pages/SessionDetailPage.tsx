/**
 * SessionDetailPage — session detail with capacity indicator and BookNow button.
 */
import { format } from 'date-fns'
import { ErrorBoundary } from 'react-error-boundary'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/common/EmptyState'
import { SkeletonCard } from '@/components/common/SkeletonCard'
import { BookNowButton } from '@/features/sessions/components/BookNowButton'
import { useSession } from '@/features/sessions/hooks/useSessions'
import { useAuthStore } from '@/features/auth/store'

const stripeConfigured = !!(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

function SessionContent({ id }: { id: number }) {
  const { data: session, isLoading, isError } = useSession(id)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (isError || !session) {
    throw new Error('Session not found')
  }

  const isPast = new Date(session.scheduled_at) < new Date()
  const isFull = session.spots_remaining === 0

  const spotsText = isPast
    ? 'This session has already taken place'
    : session.spots_remaining === 0
      ? 'Sold Out'
      : `${session.spots_remaining} of ${session.capacity} spots available`

  return (
    <div className="max-w-2xl space-y-6">
      {/* Session image */}
      {session.image_url && (
        <img
          src={session.image_url}
          alt={session.title}
          className="w-full h-56 object-cover rounded-xl border border-border"
        />
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">{session.title}</h1>
          {isPast && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              Ended
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1">By {session.creator_name ?? 'Unknown creator'}</p>
      </div>

      {/* Meta */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Date & Time</span>
          <span className="font-medium">
            {format(new Date(session.scheduled_at), 'EEE d MMM yyyy · h:mm a')}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium">{session.duration_minutes} minutes</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="font-bold text-base">${session.price}</span>
        </div>
        {/* Capacity indicator */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Availability</span>
            <span
              className={[
                'font-medium',
                isPast ? 'text-muted-foreground' : isFull ? 'text-destructive' : 'text-green-600',
              ].join(' ')}
            >
              {spotsText}
            </span>
          </div>
          {!isPast && (
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={[
                'h-2 rounded-full transition-all',
                isFull ? 'bg-destructive' : 'bg-green-500',
              ].join(' ')}
              style={{
                width: `${Math.max(
                  ((session.capacity - session.spots_remaining) / session.capacity) * 100,
                  0,
                )}%`,
              }}
            />
          </div>
          )}
        </div>
      </div>

      {/* Description */}
      {session.description && (
        <div>
          <h2 className="font-semibold mb-2">About this session</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">{session.description}</p>
        </div>
      )}

      {/* Book actions */}
      <div className="space-y-3">
        <BookNowButton
          sessionId={session.id}
          spotsRemaining={session.spots_remaining}
          isPast={isPast}
          className="w-full text-base py-4"
        />
        {stripeConfigured && !isFull && !isPast && isAuthenticated && (
          <Link
            to={`/checkout/${session.id}`}
            className="block w-full text-center rounded-md border border-primary text-primary px-4 py-3 text-base font-medium hover:bg-primary/5 transition-colors"
          >
            Pay with Stripe
          </Link>
        )}
      </div>
    </div>
  )
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <ErrorBoundary
        fallback={
          <EmptyState
            title="Session not found"
            description="This session may have been removed or does not exist."
          />
        }
      >
        <SessionContent id={Number(id)} />
      </ErrorBoundary>
    </div>
  )
}
