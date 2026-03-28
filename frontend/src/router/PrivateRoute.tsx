import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'

interface PrivateRouteProps {
  children: React.ReactNode
}

/**
 * Redirects unauthenticated users to /?redirect=<intended-url>.
 * The login page reads the redirect param and navigates there after auth.
 */
export function PrivateRoute({ children }: PrivateRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    const redirectUrl = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} replace />
  }

  return <>{children}</>
}
