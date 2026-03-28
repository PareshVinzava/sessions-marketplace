/**
 * Generic skeleton card for loading states.
 */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="h-3 bg-muted rounded w-1/3" />
      <div className="h-8 bg-muted rounded w-24 mt-4" />
    </div>
  )
}
