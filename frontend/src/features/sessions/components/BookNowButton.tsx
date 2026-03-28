/**
 * BookNow button with 6 states:
 * idle | loading | booked | full | past | unauthenticated (redirects to login)
 */
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { useBookSession } from '@/features/sessions/hooks/useSessions'

type BookNowState = 'idle' | 'loading' | 'booked' | 'full' | 'past' | 'unauthenticated'

interface BookNowButtonProps {
  sessionId: number
  spotsRemaining: number
  isPast: boolean
  className?: string
}

function getState(
  isAuthenticated: boolean,
  spotsRemaining: number,
  isPast: boolean,
  isPending: boolean,
  isSuccess: boolean,
): BookNowState {
  if (isPast) return 'past'
  if (!isAuthenticated) return 'unauthenticated'
  if (isSuccess) return 'booked'
  if (isPending) return 'loading'
  if (spotsRemaining === 0) return 'full'
  return 'idle'
}

export function BookNowButton({ sessionId, spotsRemaining, isPast, className = '' }: BookNowButtonProps) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { mutate, isPending, isSuccess } = useBookSession(sessionId)

  const state = getState(isAuthenticated, spotsRemaining, isPast, isPending, isSuccess)

  function handleClick() {
    if (state === 'unauthenticated') {
      navigate(`/login?redirect=/sessions/${sessionId}`)
      return
    }
    if (state === 'idle') {
      mutate()
    }
  }

  const labels: Record<BookNowState, string> = {
    idle: 'Book Now',
    loading: 'Booking…',
    booked: 'Booked!',
    full: 'Sold Out',
    past: 'Session Ended',
    unauthenticated: 'Sign in to Book',
  }

  const disabled = state !== 'idle' && state !== 'unauthenticated'

  const colorClass =
    state === 'full' || state === 'past'
      ? 'bg-muted text-muted-foreground cursor-not-allowed'
      : state === 'booked'
        ? 'bg-green-600 text-white cursor-default'
        : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60'

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      data-testid="book-now-button"
      data-state={state}
      className={[
        'rounded-lg px-6 py-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
        colorClass,
        className,
      ].join(' ')}
    >
      {labels[state]}
    </button>
  )
}
