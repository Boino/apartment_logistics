'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, addMonths, subMonths,
  isSameMonth, isBefore, startOfDay, parseISO, differenceInDays,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DayInfo = { date: string; status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED'; price: number | null }

interface GuestCalendarProps {
  listingId: string
  basePrice: number
  minStay: number
  maxStay?: number | null
  onRangeSelected: (checkin: string, checkout: string, nights: number, pricePerNight: number) => void
  onCleared?: () => void
}

export function GuestCalendar({ listingId, basePrice, minStay, maxStay, onRangeSelected, onCleared }: GuestCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [days, setDays] = useState<DayInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [checkin, setCheckin] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<string | null>(null) // confirmed checkout
  const [hovered, setHovered] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const from = format(startOfMonth(month), 'yyyy-MM-dd')
      const to = format(endOfMonth(addMonths(month, 1)), 'yyyy-MM-dd')
      const res = await fetch(`/api/listings/${listingId}/calendar?from=${from}&to=${to}`)
      if (res.ok) {
        const json = await res.json()
        setDays(json.data as DayInfo[])
      }
    } finally {
      setLoading(false)
    }
  }, [listingId, month])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  // Click outside calendar → clear selection
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (checkin || checkout) {
          setCheckin(null)
          setCheckout(null)
          setHovered(null)
          setError(null)
          onCleared?.()
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [checkin, checkout, onCleared])

  const dayMap = new Map(days.map((d) => [d.date, d]))
  const today = startOfDay(new Date())

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const grid = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function isRangeBlocked(from: string, to: string) {
    return days.some(
      (d) => d.date >= from && d.date < to && (d.status === 'BLOCKED' || d.status === 'BOOKED')
    )
  }

  function handleDayClick(dateStr: string) {
    const info = dayMap.get(dateStr)
    const date = parseISO(dateStr)
    if (isBefore(date, today) || info?.status === 'BLOCKED' || info?.status === 'BOOKED') return

    setError(null)

    // If we have a confirmed range already, or the click is on/before checkin → start fresh
    if (!checkin || checkout || dateStr <= checkin) {
      setCheckin(dateStr)
      setCheckout(null)
      return
    }

    // Validate second click as checkout
    const nights = differenceInDays(parseISO(dateStr), parseISO(checkin))
    if (nights < minStay) { setError(`Minimum stay is ${minStay} night(s)`); return }
    if (maxStay && nights > maxStay) { setError(`Maximum stay is ${maxStay} night(s)`); return }
    if (isRangeBlocked(checkin, dateStr)) { setError('Selected range contains unavailable dates'); return }

    const inRange = days.filter((d) => d.date >= checkin && d.date < dateStr)
    const avgPrice = inRange.length > 0
      ? inRange.reduce((sum, d) => sum + (d.price ?? basePrice), 0) / inRange.length
      : basePrice

    // Persist the confirmed selection
    setCheckout(dateStr)
    setHovered(null)
    onRangeSelected(checkin, dateStr, nights, avgPrice)
  }

  function isInConfirmedRange(dateStr: string) {
    if (!checkin || !checkout) return false
    return dateStr >= checkin && dateStr <= checkout
  }

  function isInPreviewRange(dateStr: string) {
    if (!checkin || checkout) return false // no preview once confirmed
    const end = hovered
    if (!end || end <= checkin) return false
    return dateStr > checkin && dateStr < end
  }

  const isCheckinDate = (dateStr: string) => dateStr === checkin
  const isCheckoutDate = (dateStr: string) => dateStr === checkout

  return (
    <div ref={containerRef}>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-sm">{format(month, 'MMMM yyyy')}</span>
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const info = dayMap.get(dateStr)
            const isPast = isBefore(date, today)
            const outOfMonth = !isSameMonth(date, month)
            const unavailable = isPast || info?.status === 'BLOCKED' || info?.status === 'BOOKED'
            const confirmedRange = isInConfirmedRange(dateStr)
            const preview = isInPreviewRange(dateStr)
            const isStart = isCheckinDate(dateStr)
            const isEnd = isCheckoutDate(dateStr)

            return (
              <button
                key={dateStr}
                type="button"
                disabled={outOfMonth}
                onClick={() => handleDayClick(dateStr)}
                onMouseEnter={() => !checkout && checkin && setHovered(dateStr)}
                onMouseLeave={() => !checkout && setHovered(null)}
                className={cn(
                  'flex flex-col items-center rounded-md py-1.5 text-center transition-colors',
                  outOfMonth && 'invisible',
                  unavailable && !outOfMonth && 'bg-[#f2e6e1] text-muted-foreground opacity-60 cursor-not-allowed line-through',
                  !unavailable && !confirmedRange && !preview && 'bg-[#e5f4e8] hover:bg-primary/20 cursor-pointer',
                  preview && 'bg-primary/15',
                  confirmedRange && !isStart && !isEnd && 'bg-primary/20',
                  (isStart || isEnd) && 'bg-primary text-primary-foreground rounded-md',
                )}
              >
                <span className="text-sm">{format(date, 'd')}</span>
                {!outOfMonth && !isPast && info?.price && (
                  <span className={cn('text-[9px]', isStart || isEnd ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    €{info.price}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {checkin && !checkout && (
        <p className="mt-2 text-xs text-primary">
          Check-in: <strong>{checkin}</strong> — click a check-out date
        </p>
      )}
      {checkin && checkout && (
        <p className="mt-2 text-xs text-primary">
          <strong>{checkin}</strong> → <strong>{checkout}</strong> · click outside to clear
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-[#e5f4e8]" />Available</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-[#f2e6e1]" />Unavailable</span>
      </div>
    </div>
  )
}
