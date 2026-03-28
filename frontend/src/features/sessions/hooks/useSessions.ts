/**
 * React Query hooks for the public sessions catalog.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/lib/errorUtils'
import {
  PaginatedSessionsSchema,
  SessionSchema,
  type PaginatedSessions,
  type Session,
} from '@/lib/schemas'

interface SessionFilters {
  page?: number
  price_min?: number
  price_max?: number
  date_from?: string
  date_to?: string
  status?: string
  search?: string
}

export function useSessions(filters: SessionFilters = {}) {
  return useQuery<PaginatedSessions>({
    queryKey: ['sessions', filters],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filters.page && filters.page > 1) params.page = String(filters.page)
      if (filters.price_min) params.price_min = String(filters.price_min)
      if (filters.price_max) params.price_max = String(filters.price_max)
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search

      const response = await apiClient.get('/sessions/', { params })
      const parsed = PaginatedSessionsSchema.safeParse(response.data)
      if (!parsed.success) {
        console.error('Sessions schema mismatch', parsed.error)
        return response.data as PaginatedSessions
      }
      return parsed.data
    },
  })
}

export function useSession(id: number | string) {
  return useQuery<Session>({
    queryKey: ['session', id],
    queryFn: async () => {
      const response = await apiClient.get(`/sessions/${id}/`)
      const parsed = SessionSchema.safeParse(response.data)
      if (!parsed.success) {
        console.error('Session schema mismatch', parsed.error)
        return response.data as Session
      }
      return parsed.data
    },
    enabled: !!id,
  })
}

export function useBookSession(sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/sessions/${sessionId}/book/`)
      return response.data
    },
    onMutate: () => ({ toastId: toast.loading('Booking session…') }),
    onSuccess: (_data, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.success('Session booked successfully!')
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
    onError: (error: unknown, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.error(getErrorMessage(error, 'Failed to book session'))
    },
  })
}
