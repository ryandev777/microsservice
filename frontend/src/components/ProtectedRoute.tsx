import type { ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'
import { Navigate } from 'react-router-dom'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth()

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
