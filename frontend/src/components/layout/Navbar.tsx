import { Link, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/features/auth/store'
import { apiClient } from '@/api/client'

export function Navbar() {
  const { isAuthenticated, user, clearAuth, refreshToken } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      user: s.user,
      clearAuth: s.clearAuth,
      refreshToken: s.refreshToken,
    })),
  )
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      if (refreshToken) {
        await apiClient.post('/token/blacklist/', { refresh: refreshToken })
      }
    } catch {
      // Blacklisting may fail if token already expired — still clear local state
    } finally {
      clearAuth()
      navigate('/', { replace: true })
    }
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            Sessions Marketplace
          </Link>

          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Browse
                </Link>
                {user?.role === 'CREATOR' && (
                  <Link
                    to="/creator"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Creator Dashboard
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  My Bookings
                </Link>
                <Link
                  to="/profile"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Profile
                </Link>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.firstName || user.email}
                      className="h-7 w-7 rounded-full object-cover border border-border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center border border-border">
                      {(user?.firstName || user?.email || '?')[0].toUpperCase()}
                    </span>
                  )}
                  {user?.firstName || user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium hover:text-muted-foreground transition-colors"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
