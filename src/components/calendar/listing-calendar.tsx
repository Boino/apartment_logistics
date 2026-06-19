'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isBefore,
  startOfDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DayInfo = { date: string; status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED'; price: number | null }

const STATUS_COLORS = {
  AVAILABLE: 'bg-[#e5f4e8] hover:bg-[#ceebd4]',
  BLOCKED: 'bg-[#f2e6e1] hover:bg-[#e8cfc7]',
  BOOKED: 'bg-[#dce8f5] cursor-not-allowed',
} as const

interface ListingCalendarProps {
  listingId: string
  basePrice: string
}

export function ListingCalendar({ listingId }: ListingCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [days, setDays] = useState<DayInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState<'AVAILABLE' | 'BLOCKED'>('BLOCKED')
  const [customPrice, setCustomPrice] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState('')

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    setDays([])
    try {
      const from = format(startOfMonth(month), 'yyyy-MM-dd')
      const to = format(endOfMonth(month), 'yyyy-MM-dd')
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

  const dayMap = new Map(days.map((d) => [d.date, d]))
  const today = startOfDay(new Date())
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const grid = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function isInRange(dateStr: string) {
    if (!rangeStart || !hovered) return false
    const [a, b] = [rangeStart, hovered].sort()
    return dateStr >= a && dateStr <= b
  }

  function handleDayClick(dateStr: string) {
    if (dayMap.get(dateStr)?.status === 'BOOKED') return
    if (!rangeStart) {
      setRangeStart(dateStr)
    } else {
      applyRange(rangeStart, dateStr)
      setRangeStart(null)
      setHovered(null)
    }
  }

  async function applyRange(from: string, to: string) {
    const [a, b] = [from, to].sort()
    setApplying(true)
    setApplyMsg('')
    try {
      const res = await fetch(`/api/listings/${listingId}/calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            from: a, to: b, status: newStatus,
            ...(customPrice ? { price: Number(customPrice) } : {}),
          }],
        }),
      })
      if (res.ok) {
        setApplyMsg('Saved')
        await fetchCalendar()
      } else {
        const json = await res.json()
        setApplyMsg(json.error?.message ?? 'Error')
      }
    } finally {
      setApplying(false)
    }
  }

  const selectedRange = rangeStart && hovered ? [rangeStart, hovered].sort() : null

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Calendar grid ── */}
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold">{format(month, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="py-1 text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              const info = dayMap.get(dateStr)
              const isPast = isBefore(date, today)
              const outOfMonth = !isSameMonth(date, month)
              const inRange = isInRange(dateStr)
              const isStart = rangeStart === dateStr

              const cellClass = isPast
                ? 'bg-[#f2e6e1] opacity-40 cursor-not-allowed'
                : outOfMonth
                ? 'bg-muted opacity-30'
                : info?.status === 'BOOKED'
                ? STATUS_COLORS.BOOKED
                : inRange || isStart
                ? 'bg-primary/20 ring-2 ring-primary'
                : STATUS_COLORS[info?.status ?? 'AVAILABLE']

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isPast || outOfMonth}
                  onClick={() => handleDayClick(dateStr)}
                  onMouseEnter={() => rangeStart && setHovered(dateStr)}
                  onMouseLeave={() => rangeStart && setHovered(null)}
                  className={cn('flex flex-col items-center rounded-md p-1 transition-colors', cellClass)}
                >
                  <span className="text-sm font-medium">{format(date, 'd')}</span>
                  {info?.price && !outOfMonth && !isPast && (
                    <span className="text-[10px] text-muted-foreground">€{info.price}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3">
          {(['AVAILABLE', 'BLOCKED', 'BOOKED'] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn('h-3 w-3 rounded', STATUS_COLORS[s].split(' ')[0])} />
              <span className="text-xs text-muted-foreground capitalize">{s.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Settings panel ── */}
      <div className="w-full lg:w-64 space-y-3 rounded-xl border bg-muted/30 p-4">
        <p className="font-medium text-sm">Set availability</p>

        {rangeStart ? (
          <p className="text-xs text-primary">Start: <strong>{rangeStart}</strong> — click a second date to apply.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Click a day to start a range, then click again to apply.</p>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Status</p>
          <div className="flex gap-2">
            {(['AVAILABLE', 'BLOCKED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNewStatus(s)}
                className={cn(
                  'flex-1 rounded-md border py-1 text-xs font-medium transition-colors',
                  newStatus === s ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                {s === 'AVAILABLE' ? 'Available' : 'Block'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Custom price (optional)</p>
          <input
            type="number"
            min={1}
            placeholder="Uses base price if blank"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
          />
        </div>

        {selectedRange && (
          <Button className="w-full" size="sm" disabled={applying} onClick={() => applyRange(selectedRange[0], selectedRange[1])}>
            {applying ? 'Applying…' : `Apply ${selectedRange[0]} → ${selectedRange[1]}`}
          </Button>
        )}

        {applyMsg && (
          <p className={cn('text-xs', applyMsg === 'Saved' ? 'text-green-600' : 'text-destructive')}>{applyMsg}</p>
        )}

        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setRangeStart(null); setHovered(null) }}>
          Clear selection
        </Button>
      </div>
    </div>
  )
}
