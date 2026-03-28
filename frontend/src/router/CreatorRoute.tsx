import { Navigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/features/auth/store'

interface CreatorRouteProps {
  children: React.ReactNode
}

/**
 * Requires both authentication AND role === CREATOR.
 * - Not authenticated → redirect to / (PrivateRoute handles auth redirect)
 * - Authenticated but not CREATOR → redirect to /dashboard
 */
export function CreatorRoute({ children }: CreatorRouteProps) {
  const { isAuthenticated, user } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      user: s.user,
    })),
  )

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'CREATOR') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
