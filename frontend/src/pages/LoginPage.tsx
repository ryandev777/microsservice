import { motion } from 'motion/react'
import { useAuth } from 'react-oidc-context'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  const auth = useAuth()

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.h1
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.6, repeat: Number.POSITIVE_INFINITY }}
          className="shimmer-text text-4xl font-extrabold tracking-tight"
        >
          Crash Game
        </motion.h1>
        <p className="mt-2 text-muted-foreground">Entre com sua conta para jogar.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4, type: 'spring', stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <Button size="lg" onClick={() => auth.signinRedirect()} disabled={auth.isLoading}>
          {auth.isLoading ? 'Redirecionando...' : 'Entrar com Keycloak'}
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-sm text-muted-foreground"
      >
        Novo por aqui?{' '}
        <button
          type="button"
          onClick={() => auth.signinRedirect({ extraQueryParams: { kc_action: 'REGISTER' } })}
          disabled={auth.isLoading}
          className="font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-50"
        >
          Criar conta
        </button>
      </motion.p>

      {auth.error && <p className="text-sm text-danger">{auth.error.message}</p>}
    </div>
  )
}
