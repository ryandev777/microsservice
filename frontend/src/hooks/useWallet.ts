import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { api } from '@/services/api'
import type { Wallet } from '@/types'

export function useWalletMe() {
  const auth = useAuth()

  return useQuery({
    queryKey: ['wallet', 'me'],
    queryFn: async () => {
      const { data } = await api.get<Wallet>('/wallets/me')
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
      const { data } = await api.post<Wallet>('/wallets')
      return data
    },
    onSuccess: (wallet) => {
      queryClient.setQueryData(['wallet', 'me'], wallet)
    },
  })
}
