import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { api } from '@/services/api'
import type {
  CashoutResponse,
  CurrentRoundView,
  CursorPage,
  MyBetItemView,
  PlaceBetResponse,
  RoundHistoryItemView,
  RoundVerification,
} from '@/types'

export function useCurrentRound() {
  return useQuery({
    queryKey: ['rounds', 'current'],
    queryFn: async () => {
      const { data } = await api.get<CurrentRoundView | null>('/games/rounds/current')
      return data
    },
    refetchOnWindowFocus: false,
  })
}

export function useRoundHistory(limit = 20, cursor: string | null = null) {
  return useQuery({
    queryKey: ['rounds', 'history', limit, cursor],
    queryFn: async () => {
      const { data } = await api.get<CursorPage<RoundHistoryItemView>>('/games/rounds/history', {
        params: { limit, cursor: cursor ?? undefined },
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

export function useMyBets(limit = 20, cursor: string | null = null) {
  const auth = useAuth()

  return useQuery({
    queryKey: ['bets', 'me', limit, cursor],
    queryFn: async () => {
      const { data } = await api.get<CursorPage<MyBetItemView>>('/games/bets/me', {
        params: { limit, cursor: cursor ?? undefined },
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
      const { data } = await api.post<PlaceBetResponse>('/games/bet', input)
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
      const { data } = await api.post<CashoutResponse>('/games/bet/cashout')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'me'] })
    },
  })
}
