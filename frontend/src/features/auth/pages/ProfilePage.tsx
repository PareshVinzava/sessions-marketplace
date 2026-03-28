import { ProfileTab } from '@/features/auth/components/ProfileTab'

export function ProfilePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Profile</h1>
      <ProfileTab />
    </div>
  )
}
