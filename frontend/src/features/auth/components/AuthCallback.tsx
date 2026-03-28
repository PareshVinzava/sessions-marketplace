/**
 * AuthCallback — handles the redirect from Django after Google OAuth.
 *
 * Django's AccountAdapter redirects to:
 *   /auth/callback#access=<jwt>&refresh=<jwt>
 *
 * This component:
 * 1. Parses the URL hash
 * 2. Fetches the user profile to get role + name
 * 3. Stores tokens + user in zustand
 * 4. Redirects: CREATOR → /creator, USER → /dashboard
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import { apiClient } from '@/api/client'

export function AuthCallback() {
  const navigate = useNavigate()
  const { setAuth, clearAuth } = useAuthStore()
  const hasRun = useRef(false)

  useEffect(() => {
    // StrictMode double-invocation guard
    if (hasRun.current) return
    hasRun.current = true

    async function handleCallback() {
      const hash = window.location.hash.slice(1) // remove leading #
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access')
      const refreshToken = params.get('refresh')

      if (!accessToken || !refreshToken) {
        // No tokens in hash — something went wrong
        navigate('/', { replace: true })
        return
      }

      try {
        // Fetch profile using the new access token
        const response = await apiClient.get('/profile/', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const profile = response.data

        setAuth({
          accessToken,
          refreshToken,
          user: {
            id: profile.id ?? 0,
            email: profile.email,
            firstName: profile.first_name ?? '',
            role: profile.role,
            avatarUrl: profile.avatar_url ?? undefined,
          },
        })

        // Redirect by role
        navigate(profile.role === 'CREATOR' ? '/creator' : '/dashboard', {
          replace: true,
        })
      } catch {
        clearAuth()
        navigate('/', { replace: true })
      }
    }

    handleCallback()
  }, [navigate, setAuth, clearAuth])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  )
}
