/**
 * Vitest tests for BookingsList — upcoming vs past split.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BookingsList } from '@/features/bookings/components/BookingsList'
import type { PaginatedBookings } from '@/lib/schemas'

vi.mock('@/features/bookings/hooks/useBookings', () => ({
  useBookings: vi.fn(),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
}))

const { useBookings } = await import('@/features/bookings/hooks/useBookings')
const mockUseBookings = vi.mocked(useBookings)

function makeBooking(overrides: Partial<{
  id: number
  session_title: string
  session_scheduled_at: string
  status: 'confirmed' | 'cancelled' | 'attended'
  is_upcoming: boolean
}>) {
  return {
    id: overrides.id ?? 1,
    session: 1,
    session_title: overrides.session_title ?? 'Test Session',
    session_scheduled_at: overrides.session_scheduled_at ?? new Date(Date.now() + 86400000).toISOString(),
    session_price: '50.00',
    status: overrides.status ?? 'confirmed',
    booked_at: new Date().toISOString(),
    is_upcoming: overrides.is_upcoming ?? true,
  }
}

function makePaginated(results: ReturnType<typeof makeBooking>[]): PaginatedBookings {
  return { count: results.length, next: null, previous: null, results }
}

function renderList(statusFilter: 'upcoming' | 'past') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingsList statusFilter={statusFilter} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BookingsList — upcoming/past split', () => {
  it('shows upcoming bookings', () => {
    mockUseBookings.mockReturnValue({
      data: makePaginated([makeBooking({ id: 1, session_title: 'Future Workshop', is_upcoming: true })]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useBookings>)

    renderList('upcoming')
    expect(screen.getByText('Future Workshop')).toBeInTheDocument()
  })

  it('shows empty state for upcoming when no bookings', () => {
    mockUseBookings.mockReturnValue({
      data: makePaginated([]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useBookings>)

    renderList('upcoming')
    expect(screen.getByText('No upcoming bookings')).toBeInTheDocument()
  })

  it('shows empty state for past when no bookings', () => {
    mockUseBookings.mockReturnValue({
      data: makePaginated([]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useBookings>)

    renderList('past')
    expect(screen.getByText('No past bookings')).toBeInTheDocument()
  })

  it('shows skeleton while loading', () => {
    mockUseBookings.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useBookings>)

    renderList('upcoming')
    // Skeleton cards render as animate-pulse divs
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows cancelled status badge', () => {
    mockUseBookings.mockReturnValue({
      data: makePaginated([
        makeBooking({ id: 2, session_title: 'Cancelled Session', status: 'cancelled', is_upcoming: false }),
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useBookings>)

    renderList('past')
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })
})
