import type { AuthProviderProps } from 'react-oidc-context'
import { WebStorageStateStore } from 'oidc-client-ts'

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080'
const realm = import.meta.env.VITE_KEYCLOAK_REALM ?? 'crash-game'
const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'crash-game-client'

export const oidcConfig: AuthProviderProps = {
  authority: `${keycloakUrl}/realms/${realm}`,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/login`,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}
