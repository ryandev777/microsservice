import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { api } from '@/services/api'
import type { CreateWalletResponse, WalletBalanceView } from '@/types'

export function useWalletMe() {
  const auth = useAuth()

  return useQuery({
    queryKey: ['wallet', 'me'],
    queryFn: async () => {
      const { data } = await api.get<WalletBalanceView>('/wallets/me')
      return data
    },
    enabled: auth.isAuthenticated,
    retry: false,
  })
}

export function useCreateWallet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CreateWalletResponse>('/wallets')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'me'] })
    },
  })
}
