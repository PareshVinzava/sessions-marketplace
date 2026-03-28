/**
 * ProfileTab — react-hook-form + zod for profile editing.
 * Displays and PATCHes first_name and avatar_url via /api/profile/.
 */
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { ProfileUpdateSchema, UserProfileSchema, type ProfileUpdate, type UserProfile } from '@/lib/schemas'
import { useAuthStore } from '@/features/auth/store'
import { getErrorMessage } from '@/lib/errorUtils'

async function fetchProfile(): Promise<UserProfile> {
  const res = await apiClient.get('/profile/')
  return UserProfileSchema.parse(res.data)
}

async function updateProfile(data: ProfileUpdate): Promise<UserProfile> {
  const res = await apiClient.patch('/profile/', data)
  return UserProfileSchema.parse(res.data)
}

export function ProfileTab() {
  const queryClient = useQueryClient()
  const { user, setUser } = useAuthStore()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  })

  const becomeCreator = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/profile/become-creator/')
      return UserProfileSchema.parse(res.data)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated)
      if (user) setUser({ ...user, role: 'CREATOR' })
      toast.success("You're now a Creator! Redirecting to your dashboard…")
      setTimeout(() => { window.location.href = '/creator' }, 1500)
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to upgrade role')),
  })

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated)
      // Keep navbar avatar/name in sync with saved profile
      if (user) {
        setUser({
          ...user,
          firstName: updated.first_name ?? user.firstName,
          avatarUrl: updated.avatar_url ?? undefined,
        })
      }
      toast.success('Profile updated')
    },
    onError: () => {
      toast.error('Failed to update profile')
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileUpdate>({
    resolver: zodResolver(ProfileUpdateSchema),
    defaultValues: { first_name: '', avatar_url: '' },
  })

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name ?? '',
        avatar_url: profile.avatar_url ?? '',
      })
    }
  }, [profile, reset])

  if (isLoading) {
    return <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-muted rounded" />
      <div className="h-10 bg-muted rounded" />
    </div>
  }

  const avatarUrlValue = watch('avatar_url')

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-semibold mb-6">Edit Profile</h2>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-5">

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="first_name">
            Display Name
          </label>
          <input
            id="first_name"
            {...register('first_name')}
            placeholder="Your name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.first_name && (
            <p className="text-xs text-destructive">{errors.first_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="avatar_url">
            Avatar URL
          </label>
          <div className="flex items-center gap-3">
            {avatarUrlValue ? (
              <img
                src={avatarUrlValue}
                alt="Avatar preview"
                className="h-12 w-12 rounded-full object-cover border border-border flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <span className="h-12 w-12 rounded-full bg-muted text-muted-foreground text-lg font-semibold flex items-center justify-center border border-border flex-shrink-0">
                {(profile?.first_name || profile?.email || '?')[0].toUpperCase()}
              </span>
            )}
            <input
              id="avatar_url"
              {...register('avatar_url')}
              placeholder="https://example.com/avatar.png"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {errors.avatar_url && (
            <p className="text-xs text-destructive">{errors.avatar_url.message}</p>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Email:</span> {profile?.email}
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Role:</span>{' '}
          <span className={profile?.role === 'CREATOR' ? 'text-primary font-semibold' : ''}>
            {profile?.role}
          </span>
        </div>

        <button
          type="submit"
          disabled={!isDirty || mutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Become a Creator — only shown to regular users */}
      {profile?.role === 'USER' && (
        <div className="mt-8 rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-base">Become a Creator</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage your own sessions, track bookings, and earn revenue.
            </p>
          </div>
          <button
            onClick={() => becomeCreator.mutate()}
            disabled={becomeCreator.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {becomeCreator.isPending ? 'Upgrading…' : 'Become a Creator'}
          </button>
        </div>
      )}
    </div>
  )
}
