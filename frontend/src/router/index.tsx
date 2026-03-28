import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { PrivateRoute } from './PrivateRoute'
import { CreatorRoute } from './CreatorRoute'
import { AuthCallback } from '@/features/auth/components/AuthCallback'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { HomePage } from '@/features/sessions/pages/HomePage'
import { SessionDetailPage } from '@/features/sessions/pages/SessionDetailPage'
import { UserDashboardPage } from '@/features/auth/pages/UserDashboardPage'
import { ProfilePage } from '@/features/auth/pages/ProfilePage'
import { CreatorDashboardPage } from '@/features/creator/pages/CreatorDashboardPage'
import { CheckoutPage } from '@/features/sessions/pages/CheckoutPage'

export const router = createBrowserRouter([
  {
    // Auth callback — outside Layout (no navbar needed)
    path: '/auth/callback',
    element: <AuthCallback />,
  },
  {
    // All other routes share the Layout (Navbar)
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/sessions/:id',
        element: <SessionDetailPage />,
      },
      {
        path: '/checkout/:id',
        element: (
          <PrivateRoute>
            <CheckoutPage />
          </PrivateRoute>
        ),
      },
      {
        path: '/dashboard',
        element: (
          <PrivateRoute>
            <UserDashboardPage />
          </PrivateRoute>
        ),
      },
      {
        path: '/profile',
        element: (
          <PrivateRoute>
            <ProfilePage />
          </PrivateRoute>
        ),
      },
      {
        path: '/creator',
        element: (
          <CreatorRoute>
            <CreatorDashboardPage />
          </CreatorRoute>
        ),
      },
    ],
  },
])
