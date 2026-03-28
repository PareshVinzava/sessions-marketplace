/**
 * Session card for the catalog list.
 * Shows title, creator, price, date, and available spots.
 */
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { SessionListItem } from '@/lib/schemas'

interface SessionCardProps {
  session: SessionListItem
  index?: number
}

export function SessionCard({ session, index = 0 }: SessionCardProps) {
  const isPast = new Date(session.scheduled_at) < new Date()
  const isFull = session.spots_remaining === 0

  const spotsText = isPast
    ? 'Ended'
    : isFull
      ? 'Sold Out'
      : `${session.spots_remaining} spot${session.spots_remaining === 1 ? '' : 's'} left`

  const badgeClass = isPast
    ? 'bg-muted text-muted-foreground'
    : isFull
      ? 'bg-destructive/10 text-destructive'
      : 'bg-primary/10 text-primary'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        to={`/sessions/${session.id}`}
        className={[
          'block rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow',
          isPast ? 'opacity-60' : '',
        ].join(' ')}
      >
        {/* Session image */}
        {session.image_url && (
          <img
            src={session.image_url}
            alt={session.title}
            className="w-full h-40 object-cover"
          />
        )}
        <div className="p-5 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-foreground line-clamp-2">{session.title}</h3>

        {/* Creator */}
        <p className="text-sm text-muted-foreground">{session.creator_name ?? 'Unknown creator'}</p>

        {/* Date */}
        <p className="text-sm text-muted-foreground">
          {format(new Date(session.scheduled_at), 'EEE d MMM · h:mm a')}
          {' · '}
          {session.duration_minutes} min
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className={['text-lg font-bold', isPast ? 'text-muted-foreground' : 'text-foreground'].join(' ')}>
            ${session.price}
          </span>
          <span className={['text-xs font-medium px-2 py-1 rounded-full', badgeClass].join(' ')}>
            {spotsText}
          </span>
        </div>
        </div>
      </Link>
    </motion.div>
  )
}
