import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.isAuthenticated && !auth.isLoading && !auth.activeNavigator) {
      // Auto-redirect on first load; the button below is a manual fallback.
    }
  }, [auth])

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold text-accent">Crash Game</h1>
        <p className="mt-2 text-muted-foreground">Entre com sua conta para jogar.</p>
      </div>
      <Button size="lg" onClick={() => auth.signinRedirect()} disabled={auth.isLoading}>
        {auth.isLoading ? 'Redirecionando...' : 'Entrar com Keycloak'}
      </Button>
      {auth.error && <p className="text-sm text-danger">{auth.error.message}</p>}
    </div>
  )
}
