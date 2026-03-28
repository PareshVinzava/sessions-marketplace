/**
 * Zod schemas — single source of truth for all data shapes.
 * TypeScript types are inferred from schemas (never defined separately).
 */
import { z } from 'zod'

// ── Auth / User ──────────────────────────────────────────────────────────────
export const UserRoleSchema = z.enum(['USER', 'CREATOR'])

export const UserProfileSchema = z.object({
  first_name: z.string().max(150).optional().default(''),
  email: z.string().email(),
  role: UserRoleSchema,
  bio: z.string().optional().default(''),
  avatar_url: z.string().url().optional().or(z.literal('')),
  updated_at: z.string().datetime().optional(),
})

export const ProfileUpdateSchema = z.object({
  first_name: z.string().max(150, 'Name is too long').optional(),
  bio: z.string().optional(),
  avatar_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
})

export type UserProfile = z.infer<typeof UserProfileSchema>
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>

// ── Session ──────────────────────────────────────────────────────────────────
export const SessionStatusSchema = z.enum(['draft', 'published', 'cancelled', 'completed'])

export const SessionSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().default(''),
  price: z.string(),
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number(),
  capacity: z.number(),
  status: SessionStatusSchema,
  image_url: z.string().optional().default(''),
  creator: z.number().optional(),
  creator_name: z.string().optional().default(''),
  spots_remaining: z.number(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export const SessionListItemSchema = SessionSchema.pick({
  id: true,
  title: true,
  price: true,
  scheduled_at: true,
  duration_minutes: true,
  capacity: true,
  status: true,
  image_url: true,
  spots_remaining: true,
}).extend({
  creator_name: z.string().optional().default(''),
})

export const PaginatedSessionsSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(SessionListItemSchema),
})

export const SessionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional().default(''),
  price: z.string().min(1, 'Price is required'),
  scheduled_at: z.string().min(1, 'Date & time is required'),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  capacity: z.number().int().min(1).max(1000).default(10),
  status: SessionStatusSchema.default('draft'),
  image_url: z.string().url().optional().or(z.literal('')),
})

export type Session = z.infer<typeof SessionSchema>
export type SessionListItem = z.infer<typeof SessionListItemSchema>
export type PaginatedSessions = z.infer<typeof PaginatedSessionsSchema>
export type SessionCreate = z.infer<typeof SessionCreateSchema>
export type SessionStatus = z.infer<typeof SessionStatusSchema>

// ── Booking ──────────────────────────────────────────────────────────────────
export const BookingStatusSchema = z.enum(['confirmed', 'cancelled', 'attended'])

export const BookingSchema = z.object({
  id: z.number(),
  session: z.number(),
  session_title: z.string(),
  session_scheduled_at: z.string().datetime(),
  session_price: z.string(),
  status: BookingStatusSchema,
  booked_at: z.string().datetime(),
  is_upcoming: z.boolean(),
})

export const PaginatedBookingsSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(BookingSchema),
})

export type Booking = z.infer<typeof BookingSchema>
export type PaginatedBookings = z.infer<typeof PaginatedBookingsSchema>

// ── Creator Session (with booking_count) ─────────────────────────────────────
export const CreatorSessionSchema = SessionSchema.extend({
  booking_count: z.number().default(0),
})

export const PaginatedCreatorSessionsSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(CreatorSessionSchema),
})

export type CreatorSession = z.infer<typeof CreatorSessionSchema>
export type PaginatedCreatorSessions = z.infer<typeof PaginatedCreatorSessionsSchema>

// ── Checkout / Stripe ─────────────────────────────────────────────────────────
export const CheckoutResponseSchema = z.object({
  client_secret: z.string(),
  publishable_key: z.string(),
})

export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>

// ── Upload ────────────────────────────────────────────────────────────────────
export const UploadResponseSchema = z.object({
  url: z.string().url(),
})

export type UploadResponse = z.infer<typeof UploadResponseSchema>
