/**
 * HomePage — Session catalog with filters, pagination, and skeleton loading.
 */
import { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { EmptyState } from '@/components/common/EmptyState'
import { SkeletonCard } from '@/components/common/SkeletonCard'
import { SessionCard } from '@/features/sessions/components/SessionCard'
import { SessionFilters } from '@/features/sessions/components/SessionFilters'
import { useSessions } from '@/features/sessions/hooks/useSessions'

interface Filters {
  price_min?: number
  price_max?: number
  search?: string
}

function SessionList({ filters, page }: { filters: Filters; page: number }) {
  const { data, isLoading, isError } = useSessions({ ...filters, page })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    throw new Error('Failed to load sessions')
  }

  if (!data || data.results.length === 0) {
    return (
      <EmptyState
        title="No sessions found"
        description="Try adjusting your filters or check back later."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {data.results.map((session, index) => (
        <SessionCard key={session.id} session={session} index={index} />
      ))}
    </div>
  )
}

function PaginationControls({
  page,
  onPageChange,
  hasNext,
  hasPrev,
}: {
  page: number
  onPageChange: (p: number) => void
  hasNext: boolean
  hasPrev: boolean
}) {
  return (
    <div className="flex justify-center gap-3 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
        className="px-4 py-2 rounded-md border border-border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
      >
        Previous
      </button>
      <span className="px-4 py-2 text-sm font-medium text-muted-foreground">Page {page}</span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className="px-4 py-2 rounded-md border border-border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
      >
        Next
      </button>
    </div>
  )
}

export function HomePage() {
  const [filters, setFilters] = useState<Filters>({})
  const [page, setPage] = useState(1)
  const { data } = useSessions({ ...filters, page })

  function handleFilterChange(newFilters: Filters) {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Browse Sessions</h1>
        <p className="text-muted-foreground mt-1">
          Discover expert-led sessions and book your spot.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filter sidebar */}
        <div className="lg:w-64 shrink-0">
          <SessionFilters onFilterChange={handleFilterChange} />
        </div>

        {/* Session grid */}
        <div className="flex-1">
          <ErrorBoundary
            fallback={
              <EmptyState
                title="Something went wrong"
                description="Could not load sessions. Please refresh the page."
              />
            }
          >
            <SessionList filters={filters} page={page} />
          </ErrorBoundary>

          {data && (
            <PaginationControls
              page={page}
              onPageChange={setPage}
              hasNext={!!data.next}
              hasPrev={!!data.previous}
            />
          )}
        </div>
      </div>
    </div>
  )
}
