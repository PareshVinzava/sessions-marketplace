/**
 * Central error message resolver.
 * Maps API error codes and HTTP status codes to user-friendly messages.
 */

interface ApiError {
  response?: {
    status?: number
    data?: { error?: string; code?: string; detail?: string }
    headers?: Record<string, string>
  }
  message?: string
}

const CODE_MESSAGES: Record<string, string> = {
  session_full: 'This session is fully booked.',
  already_booked: "You've already booked this session.",
  session_unavailable: 'This session is no longer available for booking.',
  oauth_unconfigured: 'Google login is not configured on this server.',
  storage_unconfigured: 'File uploads are not available right now.',
  payment_unconfigured: 'Payments are not configured on this server.',
  authentication_failed: 'Your session has expired. Please sign in again.',
  not_authenticated: 'Please sign in to continue.',
  permission_denied: "You don't have permission to do this.",
}

/**
 * Extracts a user-friendly error message from an Axios error.
 * Falls back to `fallback` if nothing specific is found.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = error as ApiError

  const status = err?.response?.status
  const code = err?.response?.data?.code
  const apiError = err?.response?.data?.error

  // Rate limited — extract wait time from message or Retry-After header
  if (status === 429 || code === 'throttled') {
    const retryAfter = err?.response?.headers?.['retry-after']
    const seconds = retryAfter ? parseInt(retryAfter, 10) : null
    const waitText = seconds && !isNaN(seconds) ? ` Please wait ${seconds} second${seconds !== 1 ? 's' : ''}.` : ' Please wait a moment.'
    return `Too many requests.${waitText}`
  }

  // Known error codes
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code]
  }

  // 401 / 403
  if (status === 401) return 'Please sign in to continue.'
  if (status === 403) return "You don't have permission to do this."

  // Server error
  if (status && status >= 500) return 'Something went wrong on our end. Please try again.'

  // Network error (no response)
  if (!err?.response && err?.message) {
    return "Can't connect to the server. Check your connection."
  }

  // Use the API error message if it's short and readable (not a raw Django traceback)
  if (apiError && apiError.length < 120) return apiError

  return fallback
}
