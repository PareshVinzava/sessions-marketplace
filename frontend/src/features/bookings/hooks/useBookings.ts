/**
 * React Query hooks for user bookings.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/lib/errorUtils'
import { PaginatedBookingsSchema, type PaginatedBookings } from '@/lib/schemas'

type BookingStatusFilter = 'upcoming' | 'past' | undefined

export function useBookings(statusFilter?: BookingStatusFilter) {
  return useQuery<PaginatedBookings>({
    queryKey: ['bookings', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      const response = await apiClient.get('/bookings/', { params })
      const parsed = PaginatedBookingsSchema.safeParse(response.data)
      if (!parsed.success) {
        console.error('Bookings schema mismatch', parsed.error)
        return response.data as PaginatedBookings
      }
      return parsed.data
    },
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (bookingId: number) => {
      await apiClient.delete(`/bookings/${bookingId}/`)
    },
    onMutate: async (bookingId) => {
      // Optimistic update: mark booking as cancelled immediately
      await queryClient.cancelQueries({ queryKey: ['bookings'] })
      const previousUpcoming = queryClient.getQueryData<PaginatedBookings>(['bookings', 'upcoming'])
      if (previousUpcoming) {
        queryClient.setQueryData<PaginatedBookings>(['bookings', 'upcoming'], {
          ...previousUpcoming,
          results: previousUpcoming.results.filter((b) => b.id !== bookingId),
        })
      }
      return { previousUpcoming }
    },
    onError: (err, _bookingId, context) => {
      // Rollback on error
      if (context?.previousUpcoming) {
        queryClient.setQueryData(['bookings', 'upcoming'], context.previousUpcoming)
      }
      toast.error(getErrorMessage(err, 'Failed to cancel booking'))
    },
    onSuccess: () => {
      toast.success('Booking cancelled')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
