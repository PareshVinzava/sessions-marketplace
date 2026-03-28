/**
 * CreatorDashboard Vitest tests:
 * - Error boundary renders fallback when API throws
 * - Skeleton shows during isLoading
 * - Charts render when sessions have data
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/features/creator/hooks/useCreatorSessions', () => ({
  useCreatorSessions: vi.fn(),
  useDeleteSession: vi.fn(() => ({ mutate: vi.fn() })),
  useCreateSession: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateSession: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/features/auth/store', () => ({
  useAuthStore: vi.fn(() => true),
}))

// recharts ResponsiveContainer needs a DOM width — provide a fixed one
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  }
})

import { useCreatorSessions } from '@/features/creator/hooks/useCreatorSessions'
import { CreatorDashboardPage } from '@/features/creator/pages/CreatorDashboardPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreatorDashboardPage', () => {
  it('shows skeleton while loading', () => {
    vi.mocked(useCreatorSessions).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useCreatorSessions>)

    render(
      <Wrapper>
        <CreatorDashboardPage />
      </Wrapper>,
    )

    // SkeletonCard renders a div with animate-pulse class
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error boundary fallback when API throws', () => {
    vi.mocked(useCreatorSessions).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useCreatorSessions>)

    // Suppress React error boundary console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <Wrapper>
        <CreatorDashboardPage />
      </Wrapper>,
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it('renders stats and charts when sessions are loaded', () => {
    const mockSessions = [
      {
        id: 1,
        title: 'Python Basics',
        price: '50.00',
        scheduled_at: new Date().toISOString(),
        duration_minutes: 60,
        capacity: 10,
        status: 'published' as const,
        spots_remaining: 8,
        booking_count: 2,
        creator: 1,
        creator_name: 'Test Creator',
        image_url: '',
        description: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    vi.mocked(useCreatorSessions).mockReturnValue({
      data: { count: 1, next: null, previous: null, results: mockSessions },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCreatorSessions>)

    render(
      <Wrapper>
        <CreatorDashboardPage />
      </Wrapper>,
    )

    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('Total Bookings')).toBeInTheDocument()
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('Bookings per Session')).toBeInTheDocument()
    expect(screen.getByText('Revenue (last 30 days)')).toBeInTheDocument()
  })

  it('shows empty state when no sessions', () => {
    vi.mocked(useCreatorSessions).mockReturnValue({
      data: { count: 0, next: null, previous: null, results: [] },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useCreatorSessions>)

    render(
      <Wrapper>
        <CreatorDashboardPage />
      </Wrapper>,
    )

    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument()
  })
})

describe('ErrorBoundary integration', () => {
  it('renders custom fallback with retry button when child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function ThrowingComponent(): React.ReactElement {
      throw new Error('API unavailable')
    }

    render(
      <Wrapper>
        <ErrorBoundary
          fallback={
            <div>
              <p>Something went wrong</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          }
        >
          <ThrowingComponent />
        </ErrorBoundary>
      </Wrapper>,
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    consoleSpy.mockRestore()
  })
})
