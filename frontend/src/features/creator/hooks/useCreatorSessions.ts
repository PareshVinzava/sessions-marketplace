/**
 * React Query hooks for creator session management.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/lib/errorUtils'
import {
  PaginatedCreatorSessionsSchema,
  type CreatorSession,
  type PaginatedCreatorSessions,
  type SessionCreate,
} from '@/lib/schemas'

export function useCreatorSessions() {
  return useQuery<PaginatedCreatorSessions>({
    queryKey: ['creator-sessions'],
    queryFn: async () => {
      const response = await apiClient.get('/creator/sessions/')
      const parsed = PaginatedCreatorSessionsSchema.safeParse(response.data)
      if (!parsed.success) {
        console.error('Creator sessions schema mismatch', parsed.error)
        return response.data as PaginatedCreatorSessions
      }
      return parsed.data
    },
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: SessionCreate) => {
      const response = await apiClient.post('/creator/sessions/', data)
      return response.data as CreatorSession
    },
    onMutate: () => ({ toastId: toast.loading('Creating session…') }),
    onSuccess: (_data, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.success('Session created!')
      queryClient.invalidateQueries({ queryKey: ['creator-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.error(getErrorMessage(err, 'Failed to create session'))
    },
  })
}

export function useUpdateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SessionCreate> }) => {
      const response = await apiClient.patch(`/creator/sessions/${id}/`, data)
      return response.data as CreatorSession
    },
    onMutate: () => ({ toastId: toast.loading('Saving changes…') }),
    onSuccess: (_data, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.success('Session updated!')
      queryClient.invalidateQueries({ queryKey: ['creator-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.error(getErrorMessage(err, 'Failed to update session'))
    },
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/creator/sessions/${id}/`)
    },
    onMutate: () => ({ toastId: toast.loading('Deleting session…') }),
    onSuccess: (_data, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.success('Session deleted')
      queryClient.invalidateQueries({ queryKey: ['creator-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err, _vars, context) => {
      toast.dismiss(context?.toastId)
      toast.error(getErrorMessage(err, 'Failed to delete session'))
    },
  })
}
