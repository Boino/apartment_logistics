'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Photo {
  url: string
  thumbUrl?: string | null
}

interface ListingGalleryProps {
  photos: Photo[]
  title: string
}

export function ListingGallery({ photos, title }: ListingGalleryProps) {
  const [current, setCurrent] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const prev = useCallback(() => setCurrent((i) => (i - 1 + photos.length) % photos.length), [photos.length])
  const next = useCallback(() => setCurrent((i) => (i + 1) % photos.length), [photos.length])

  // Keyboard nav
  useEffect(() => {
    if (!lightbox) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(false)
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, prev, next])

  // Lock body scroll when lightbox open
  useEffect(() => {
    if (lightbox) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    // Only horizontal swipes (dx dominant)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx > 0 ? next() : prev()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  if (!photos.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        No photos yet
      </div>
    )
  }

  return (
    <>
      {/* ── Main swipeable image ── */}
      <div
        className="relative overflow-hidden rounded-2xl bg-muted select-none"
        style={{ aspectRatio: '16/9' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Image
          src={photos[current].url}
          alt={`${title} — photo ${current + 1}`}
          fill
          className="object-cover cursor-zoom-in"
          onClick={() => setLightbox(true)}
          priority={current === 0}
          sizes="(max-width:768px) 100vw, 70vw"
          draggable={false}
        />

        {photos.length > 1 && (
          <>
            {/* Arrow buttons */}
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 focus-visible:outline-none"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 focus-visible:outline-none"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to photo ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i) }}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75',
                  )}
                />
              ))}
            </div>

            {/* Counter badge */}
            <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
              {current + 1} / {photos.length}
            </span>
          </>
        )}

        {/* Click hint */}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm pointer-events-none">
          Click to enlarge
        </span>
      </div>

      {/* ── Thumbnail strip ── */}
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={cn(
                'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-all',
                i === current ? 'ring-2 ring-primary ring-offset-1' : 'opacity-50 hover:opacity-80',
              )}
            >
              <Image
                src={p.thumbUrl ?? p.url}
                alt={`Thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="96px"
              />
            </button>
          ))}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Close button */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Prev / Next */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Image (stopPropagation so clicking image doesn't close lightbox) */}
          <div
            className="relative max-h-[90vh] max-w-[92vw] w-full"
            style={{ aspectRatio: '16/9' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[current].url}
              alt={`${title} — photo ${current + 1}`}
              fill
              className="object-contain"
              sizes="92vw"
              priority
            />
          </div>

          {/* Counter */}
          {photos.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-sm text-white/80 backdrop-blur-sm">
              {current + 1} / {photos.length}
            </span>
          )}
        </div>
      )}
    </>
  )
}
