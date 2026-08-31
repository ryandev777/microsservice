import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { api } from '@/services/api'
import type { CurrentRoundState, MyBet, PaginatedResponse, RoundSummary, RoundVerification } from '@/types'

export function useCurrentRound() {
  return useQuery({
    queryKey: ['rounds', 'current'],
    queryFn: async () => {
      const { data } = await api.get<CurrentRoundState>('/games/rounds/current')
      return data
    },
    refetchOnWindowFocus: false,
  })
}

export function useRoundHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['rounds', 'history', page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<RoundSummary>>('/games/rounds/history', {
        params: { page, pageSize },
      })
      return data
    },
  })
}

export function useRoundVerify(roundId: string | null) {
  return useQuery({
    queryKey: ['rounds', 'verify', roundId],
    queryFn: async () => {
      const { data } = await api.get<RoundVerification>(`/games/rounds/${roundId}/verify`)
      return data
    },
    enabled: Boolean(roundId),
  })
}

export function useMyBets(page = 1, pageSize = 20) {
  const auth = useAuth()

  return useQuery({
    queryKey: ['bets', 'me', page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<MyBet>>('/games/bets/me', {
        params: { page, pageSize },
      })
      return data
    },
    enabled: auth.isAuthenticated,
  })
}

interface PlaceBetInput {
  amountCents: number
}

export function usePlaceBet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: PlaceBetInput) => {
      const { data } = await api.post<MyBet>('/games/bet', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'me'] })
    },
  })
}

export function useCashout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<MyBet>('/games/bet/cashout')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'me'] })
    },
  })
}
