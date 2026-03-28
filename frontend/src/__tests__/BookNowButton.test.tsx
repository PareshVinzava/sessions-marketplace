/**
 * Vitest tests for BookNowButton component.
 * - Shows "Sold Out" when spots_remaining === 0
 * - Shows "Book Now" when authenticated and spots available
 * - Shows "Sign in to Book" when unauthenticated
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BookNowButton } from '@/features/sessions/components/BookNowButton'
import { useAuthStore } from '@/features/auth/store'

// Mock the auth store
vi.mock('@/features/auth/store', () => ({
  useAuthStore: vi.fn(),
}))

// Mock the booking mutation
vi.mock('@/features/sessions/hooks/useSessions', () => ({
  useBookSession: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  }),
}))

const mockUseAuthStore = vi.mocked(useAuthStore)

function renderButton(props: { spotsRemaining: number; isAuthenticated?: boolean; isPast?: boolean }) {
  mockUseAuthStore.mockReturnValue(props.isAuthenticated ?? true)

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookNowButton sessionId={1} spotsRemaining={props.spotsRemaining} isPast={props.isPast ?? false} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BookNowButton', () => {
  it('shows "Sold Out" when spots_remaining === 0', () => {
    renderButton({ spotsRemaining: 0, isAuthenticated: true })
    expect(screen.getByRole('button', { name: /sold out/i })).toBeInTheDocument()
  })

  it('shows "Sold Out" button as disabled when full', () => {
    renderButton({ spotsRemaining: 0, isAuthenticated: true })
    expect(screen.getByRole('button', { name: /sold out/i })).toBeDisabled()
  })

  it('shows "Book Now" when authenticated and spots available', () => {
    renderButton({ spotsRemaining: 5, isAuthenticated: true })
    expect(screen.getByRole('button', { name: /book now/i })).toBeInTheDocument()
  })

  it('shows "Sign in to Book" when unauthenticated', () => {
    renderButton({ spotsRemaining: 5, isAuthenticated: false })
    expect(screen.getByRole('button', { name: /sign in to book/i })).toBeInTheDocument()
  })

  it('has data-state="full" when spots_remaining === 0', () => {
    renderButton({ spotsRemaining: 0, isAuthenticated: true })
    const btn = screen.getByTestId('book-now-button')
    expect(btn).toHaveAttribute('data-state', 'full')
  })

  it('shows "Session Ended" and is disabled for past sessions', () => {
    renderButton({ spotsRemaining: 5, isAuthenticated: true, isPast: true })
    const btn = screen.getByRole('button', { name: /session ended/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('data-state', 'past')
  })
})
