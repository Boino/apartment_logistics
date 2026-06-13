'use client'

import * as React from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GalleryImage {
  url: string
  alt?: string
}

interface ImageGalleryProps {
  images: GalleryImage[]
  className?: string
}

export function ImageGallery({ images, className }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)

  function prev() {
    setLightboxIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null))
  }

  function next() {
    setLightboxIndex((i) => (i !== null ? (i + 1) % images.length : null))
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIndex === null) return
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') setLightboxIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!images.length) return null

  return (
    <>
      <div className={cn('grid gap-2', images.length > 1 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1', className)}>
        {images.map((img, i) => (
          <button
            key={img.url}
            className="relative aspect-video overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setLightboxIndex(i)}
          >
            <Image src={img.url} alt={img.alt ?? `Photo ${i + 1}`} fill className="object-cover transition-transform hover:scale-105" />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightboxIndex(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightboxIndex(null)}>
            <X className="h-6 w-6" />
          </button>
          <button className="absolute left-4 text-white" onClick={(e) => { e.stopPropagation(); prev() }}>
            <ChevronLeft className="h-8 w-8" />
          </button>
          <div className="relative h-[80vh] w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].alt ?? `Photo ${lightboxIndex + 1}`}
              fill
              className="object-contain"
            />
          </div>
          <button className="absolute right-4 text-white" onClick={(e) => { e.stopPropagation(); next() }}>
            <ChevronRight className="h-8 w-8" />
          </button>
          <span className="absolute bottom-4 text-sm text-white/70">{lightboxIndex + 1} / {images.length}</span>
        </div>
      )}
    </>
  )
}
