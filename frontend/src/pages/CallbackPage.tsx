import { useAuth } from 'react-oidc-context'
import { Navigate } from 'react-router-dom'

export function CallbackPage() {
  const auth = useAuth()

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (auth.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-center">
        <p className="text-danger">Falha ao autenticar: {auth.error.message}</p>
        <Navigate to="/login" replace />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Autenticando...
    </div>
  )
}
