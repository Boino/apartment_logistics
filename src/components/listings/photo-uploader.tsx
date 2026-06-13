'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

type Photo = {
  id: string
  url: string
  key: string
  thumbUrl: string | null
  thumbKey: string | null
  sortOrder: number
  isCover: boolean
  listingId: string
}

interface PhotoUploaderProps {
  listingId: string
  photos: Photo[]
  onChange: (photos: Photo[]) => void
}

export function PhotoUploader({ listingId, photos, onChange }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`/api/listings/${listingId}/photos`, { method: 'POST', body: form })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error?.message ?? 'Upload failed')
          continue
        }
        onChange([...photos, json.data])
      }
    } finally {
      setUploading(false)
    }
  }

  async function deletePhoto(photoId: string) {
    const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' })
    if (res.ok) onChange(photos.filter((p) => p.id !== photoId))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
            <Image
              src={photo.thumbUrl ?? photo.url}
              alt=""
              fill
              className="object-cover"
              sizes="200px"
            />
            <button
              type="button"
              onClick={() => deletePhoto(photo.id)}
              className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:flex"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary',
            uploading && 'opacity-50'
          )}
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">{uploading ? 'Uploading…' : 'Add photo'}</span>
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}
