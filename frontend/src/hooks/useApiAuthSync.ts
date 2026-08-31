import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { setApiToken } from '@/services/api'

/** Keeps the axios client's bearer token in sync with the current OIDC session. */
export function useApiAuthSync() {
  const auth = useAuth()
  const token = auth.user?.access_token ?? null

  useEffect(() => {
    setApiToken(token)
  }, [token])
}
