/**
 * Hooks for Stripe checkout flow.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { CheckoutResponseSchema, UploadResponseSchema, type CheckoutResponse } from '@/lib/schemas'

/**
 * Creates a Stripe PaymentIntent for the given session.
 * Uses useQuery so the intent is created once on mount (stale-forever to avoid re-creation).
 */
export function useCreatePaymentIntent(sessionId: number) {
  return useQuery<CheckoutResponse>({
    queryKey: ['checkout', sessionId],
    queryFn: async () => {
      const response = await apiClient.post(`/sessions/${sessionId}/checkout/`)
      const parsed = CheckoutResponseSchema.safeParse(response.data)
      if (!parsed.success) {
        throw new Error('Invalid checkout response')
      }
      return parsed.data
    },
    retry: false,
    staleTime: Infinity, // Never re-fetch — one intent per checkout visit
    gcTime: Infinity,    // Keep in cache even after unmount — prevent duplicate intents on back-navigation
  })
}

/**
 * Upload an image file to MinIO. Returns the public URL.
 */
export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const toastId = toast.loading('Uploading image…')
      try {
        const response = await apiClient.post('/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.dismiss(toastId)
        const parsed = UploadResponseSchema.safeParse(response.data)
        if (!parsed.success) throw new Error('Invalid upload response')
        return parsed.data.url
      } catch (err) {
        toast.dismiss(toastId)
        throw err
      }
    },
    onSuccess: () => toast.success('Image uploaded'),
    onError: () => toast.error('Upload failed'),
  })
}
