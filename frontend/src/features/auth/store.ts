/**
 * Auth store — zustand v5 with persist middleware.
 * Holds auth state only. Server data (sessions, bookings) lives in React Query.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'USER' | 'CREATOR'

interface AuthUser {
  id: number
  email: string
  firstName: string
  role: UserRole
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  setAuth: (params: {
    user: AuthUser
    accessToken: string
    refreshToken: string
  }) => void
  setUser: (user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage', // localStorage key
      // Only persist tokens and user — not derived state
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
