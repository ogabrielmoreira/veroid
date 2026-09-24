import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageLoader } from '@/components/FullPageLoader'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireGuest() {
  const { user, loading, recovery } = useAuth()
  if (loading) return <FullPageLoader />
  if (recovery) return <Navigate to="/nova-senha" replace />
  if (user) return <Navigate to="/app" replace />
  return <Outlet />
}
