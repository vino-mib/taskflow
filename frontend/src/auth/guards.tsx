import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ScreenLoader } from '../components/ScreenLoader.tsx'
import { useAuth } from './context.ts'

export function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <ScreenLoader label="Opening TaskFlow" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function GuestOnly() {
  const { user, ready } = useAuth()
  if (!ready) return <ScreenLoader label="Opening TaskFlow" />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
