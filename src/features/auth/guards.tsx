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
  const { user, loading, recovery, pendingOtp } = useAuth()
  if (loading) return <FullPageLoader />
  if (recovery) return <Navigate to="/nova-senha" replace />
  // Durante o 2º fator por e-mail o Supabase emite SIGNED_IN assim que a senha confere.
  // Sem esta exceção a tela de login seria desmontada antes de pedir o código (§5.1).
  if (user && !pendingOtp) return <Navigate to="/app" replace />
  return <Outlet />
}
