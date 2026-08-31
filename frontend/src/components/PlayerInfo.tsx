import { useAuth } from 'react-oidc-context'
import { centsToDisplay } from '@/lib/money'
import { useWalletMe } from '@/hooks/useWallet'

export function PlayerInfo() {
  const auth = useAuth()
  const { data: wallet, isLoading } = useWalletMe()

  const username =
    (auth.user?.profile.preferred_username as string | undefined) ?? auth.user?.profile.sub

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-xs text-muted-foreground">Jogador</p>
        <p className="font-semibold">{username}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Saldo</p>
        <p className="text-lg font-bold tabular-nums text-accent">
          {isLoading ? '...' : wallet ? centsToDisplay(wallet.balanceCents) : '—'}
        </p>
      </div>
    </div>
  )
}
