/**
 * CheckoutPage — Stripe PaymentElement checkout for a session.
 * Route: /checkout/:id
 */
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/common/EmptyState'
import { SkeletonCard } from '@/components/common/SkeletonCard'
import { useSession } from '@/features/sessions/hooks/useSessions'
import { useCreatePaymentIntent } from '@/features/sessions/hooks/useCheckout'

// Initialize Stripe once — uses env var baked in at build time
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

// ── Payment form (inside <Elements> context) ──────────────────────────────────
function PaymentForm({ sessionId: _sessionId }: { sessionId: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [succeeded, setSucceeded] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsSubmitting(true)
    setErrorMsg(null)

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      setErrorMsg(error.message ?? 'Payment failed')
      setIsSubmitting(false)
      return
    }

    // Payment succeeded — invalidate bookings and show success
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    setSucceeded(true)
    setIsSubmitting(false)
  }

  if (succeeded) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center space-y-4 py-8"
      >
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
        <p className="text-muted-foreground">
          Your payment was successful. Check your dashboard for the booking.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          View My Bookings
        </button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />

      {errorMsg && (
        <p className="text-sm text-destructive" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || isSubmitting}
        className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {isSubmitting ? 'Processing…' : 'Pay Now'}
      </button>

      <p className="text-xs text-center text-muted-foreground">
        Test card: 4242 4242 4242 4242 · Any future date · Any CVC
      </p>
    </form>
  )
}

// ── Checkout container ────────────────────────────────────────────────────────
function CheckoutContent({ sessionId }: { sessionId: number }) {
  const { data: session, isLoading: sessionLoading } = useSession(sessionId)
  const { data: checkout, isLoading: checkoutLoading, isError } = useCreatePaymentIntent(sessionId)

  if (sessionLoading || checkoutLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (isError || !checkout) {
    return (
      <EmptyState
        title="Payment unavailable"
        description="Stripe is not configured or there was an error. Please try again later."
      />
    )
  }

  return (
    <div className="space-y-6">
      {session && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <h2 className="font-semibold text-lg">{session.title}</h2>
          <p className="text-muted-foreground text-sm">By {session.creator_name}</p>
          <p className="text-2xl font-bold">${session.price}</p>
        </div>
      )}

      <AnimatePresence>
        <motion.div
          key="payment-form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: checkout.client_secret,
              appearance: { theme: 'stripe' },
            }}
          >
            <PaymentForm sessionId={sessionId} />
          </Elements>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function CheckoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const sessionId = Number(id)

  if (!stripePublishableKey) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <EmptyState
          title="Payment not configured"
          description="Stripe publishable key is missing. Set VITE_STRIPE_PUBLISHABLE_KEY."
        />
      </div>
    )
  }

  if (!id || isNaN(sessionId)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <EmptyState title="Invalid session" description="Session ID is missing or invalid." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Complete Booking</h1>
      </div>

      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <CheckoutContent sessionId={sessionId} />
      </div>
    </div>
  )
}
