/**
 * Create/Edit session dialog with react-hook-form + zod + react-dropzone image upload.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { SessionCreateSchema, type CreatorSession, type SessionCreate } from '@/lib/schemas'
import { useCreateSession, useUpdateSession } from '@/features/creator/hooks/useCreatorSessions'
import { useUploadImage } from '@/features/sessions/hooks/useCheckout'

interface SessionFormDialogProps {
  session?: CreatorSession | null
  onClose: () => void
}

export function SessionFormDialog({ session, onClose }: SessionFormDialogProps) {
  const isEdit = !!session
  const { mutate: create, isPending: isCreating } = useCreateSession()
  const { mutate: update, isPending: isUpdating } = useUpdateSession()
  const { mutate: uploadImage, isPending: isUploading } = useUploadImage()
  const isPending = isCreating || isUpdating || isUploading

  const [imagePreview, setImagePreview] = useState<string | null>(session?.image_url || null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SessionCreate>({
    resolver: zodResolver(SessionCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      price: '',
      scheduled_at: '',
      duration_minutes: 60,
      capacity: 10,
      status: 'draft',
      image_url: '',
    },
  })

  // Revoke blob URLs when preview changes or component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Show rejection reason if file was invalid
      if (rejectedFiles.length > 0) {
        const reason = rejectedFiles[0]?.errors[0]?.message ?? 'Invalid file'
        toast.error(`Image rejected: ${reason}`)
        return
      }

      const file = acceptedFiles[0]
      if (!file) return
      // Show local preview immediately (blob URL — revoked when replaced)
      const blobUrl = URL.createObjectURL(file)
      setImagePreview(blobUrl)
      // Upload to MinIO and replace blob with permanent URL on success
      uploadImage(file, {
        onSuccess: (url) => {
          setValue('image_url', url)
          setImagePreview(url)
        },
      })
    },
    [uploadImage, setValue],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  })

  // Populate form when editing
  useEffect(() => {
    if (session) {
      reset({
        title: session.title,
        description: session.description ?? '',
        price: session.price,
        scheduled_at: session.scheduled_at
          ? (() => {
              const d = new Date(session.scheduled_at)
              const offset = d.getTimezoneOffset()
              return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16)
            })()
          : '',
        duration_minutes: session.duration_minutes,
        capacity: session.capacity,
        status: session.status,
        image_url: session.image_url ?? '',
      })
    }
  }, [session, reset])

  function onSubmit(data: SessionCreate) {
    if (isEdit && session) {
      update(
        { id: session.id, data },
        { onSuccess: onClose },
      )
    } else {
      create(data, { onSuccess: onClose })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-background border border-border p-6 shadow-xl space-y-5 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {isEdit ? 'Edit Session' : 'Create Session'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="title">Title *</label>
            <input
              id="title"
              {...register('title')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={3}
              {...register('description')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Price & Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="price">Price ($) *</label>
              <input
                id="price"
                type="text"
                {...register('price')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="duration">Duration (min)</label>
              <input
                id="duration"
                type="number"
                {...register('duration_minutes', { valueAsNumber: true })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Scheduled at */}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="scheduled_at">Date & Time * <span className="font-normal text-muted-foreground">(your local time)</span></label>
            <input
              id="scheduled_at"
              type="datetime-local"
              {...register('scheduled_at')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.scheduled_at && (
              <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>
            )}
          </div>

          {/* Capacity & Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="capacity">Capacity</label>
              <input
                id="capacity"
                type="number"
                {...register('capacity', { valueAsNumber: true })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="status">Status</label>
              <select
                id="status"
                {...register('status')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Session Image</label>
            <div
              {...getRootProps()}
              className={[
                'rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:border-primary/50',
              ].join(' ')}
            >
              <input {...getInputProps()} />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mx-auto max-h-32 rounded object-cover"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? 'Drop image here…'
                    : 'Drag & drop an image, or click to select (max 5 MB)'}
                </p>
              )}
              {isUploading && (
                <p className="text-xs text-primary mt-2">Uploading…</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Session'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
