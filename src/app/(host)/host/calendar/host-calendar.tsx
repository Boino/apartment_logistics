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
type Listing = { id: string; title: string }

interface HostCalendarProps {
  listings: Listing[]
}

const STATUS_COLORS = {
  AVAILABLE: 'bg-[#e5f4e8] hover:bg-[#ceebd4]',
  BLOCKED: 'bg-[#f2e6e1] hover:bg-[#e8cfc7]',
  BOOKED: 'bg-[#dce8f5] hover:bg-[#c8d9ec] cursor-not-allowed',
} as const

const STATUS_LABELS = { AVAILABLE: 'Available', BLOCKED: 'Blocked', BOOKED: 'Booked' }

export function HostCalendar({ listings }: HostCalendarProps) {
  const [selectedId, setSelectedId] = useState(listings[0]?.id ?? '')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [days, setDays] = useState<DayInfo[]>([])
  const [loading, setLoading] = useState(false)

  // range selection
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  // settings panel
  const [newStatus, setNewStatus] = useState<'AVAILABLE' | 'BLOCKED'>('BLOCKED')
  const [customPrice, setCustomPrice] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState('')

  const fetchCalendar = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    setDays([])
    try {
      const from = format(startOfMonth(month), 'yyyy-MM-dd')
      const to = format(endOfMonth(month), 'yyyy-MM-dd')
      const res = await fetch(`/api/listings/${selectedId}/calendar?from=${from}&to=${to}`)
      if (res.ok) {
        const json = await res.json()
        setDays(json.data as DayInfo[])
      }
    } finally {
      setLoading(false)
    }
  }, [selectedId, month])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  const dayMap = new Map(days.map((d) => [d.date, d]))
  const today = startOfDay(new Date())

  // build calendar grid
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const grid = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function isInRange(date: string) {
    if (!rangeStart || !hovered) return false
    const [a, b] = [rangeStart, hovered].sort()
    return date >= a && date <= b
  }

  function handleDayClick(dateStr: string) {
    const day = dayMap.get(dateStr)
    if (day?.status === 'BOOKED') return // can't edit booked days

    if (!rangeStart) {
      setRangeStart(dateStr)
    } else {
      // apply the range
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
      const res = await fetch(`/api/listings/${selectedId}/calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            from: a,
            to: b,
            status: newStatus,
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

  const selectedRange = rangeStart && hovered
    ? [rangeStart, hovered].sort()
    : null

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Availability Calendar</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ── Calendar ── */}
        <div className="flex-1">
          {/* listing selector */}
          <div className="mb-4">
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setRangeStart(null) }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {listings.length === 0 && <option value="">No listings yet</option>}
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>

          {/* month navigator */}
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold">{format(month, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* day-of-week headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1 text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* day grid */}
          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {grid.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd')
                const info = dayMap.get(dateStr)
                const isPast = isBefore(date, today)
                const outOfMonth = !isSameMonth(date, month)
                const inRange = isInRange(dateStr)
                const isStart = rangeStart === dateStr

                const statusClass = isPast
                  ? 'bg-[#f2e6e1] opacity-50 cursor-not-allowed'
                  : outOfMonth
                  ? 'bg-muted opacity-40'
                  : info?.status === 'BOOKED'
                  ? STATUS_COLORS.BOOKED
                  : inRange || isStart
                  ? 'bg-primary/20 ring-2 ring-primary'
                  : info
                  ? STATUS_COLORS[info.status]
                  : STATUS_COLORS.AVAILABLE

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isPast || outOfMonth || !selectedId}
                    onClick={() => handleDayClick(dateStr)}
                    onMouseEnter={() => rangeStart && setHovered(dateStr)}
                    onMouseLeave={() => rangeStart && setHovered(null)}
                    className={cn(
                      'flex flex-col items-center rounded-md p-1 text-center transition-colors',
                      statusClass
                    )}
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

          {/* legend */}
          <div className="mt-4 flex flex-wrap gap-4">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={cn('h-3 w-3 rounded', STATUS_COLORS[status as keyof typeof STATUS_COLORS].split(' ')[0])} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Settings panel ── */}
        <div className="w-full lg:w-72 space-y-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="mb-4 font-semibold">Set availability</h2>

            {rangeStart ? (
              <p className="mb-3 text-sm text-primary">
                Range started: <strong>{rangeStart}</strong><br />
                Click a second date to apply.
              </p>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">
                Click a day to start a range, then click again to apply.
              </p>
            )}

            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
                <div className="flex gap-2">
                  {(['AVAILABLE', 'BLOCKED'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewStatus(s)}
                      className={cn(
                        'flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors',
                        newStatus === s
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      {s === 'AVAILABLE' ? 'Available' : 'Block'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Custom price (optional)
                </p>
                <input
                  type="number"
                  min={1}
                  placeholder="Leave blank for base price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                />
              </div>

              {selectedRange && (
                <Button
                  className="w-full"
                  disabled={applying}
                  onClick={() => applyRange(selectedRange[0], selectedRange[1])}
                >
                  {applying ? 'Applying…' : `Apply to ${selectedRange[0]} → ${selectedRange[1]}`}
                </Button>
              )}

              {applyMsg && (
                <p className={cn('text-sm', applyMsg === 'Saved' ? 'text-green-600' : 'text-destructive')}>
                  {applyMsg}
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { setRangeStart(null); setHovered(null) }}
              >
                Clear selection
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm text-sm">
            <p className="font-medium mb-2">How it works</p>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li>• Click a day to start a date range</li>
              <li>• Click a second day to select the range</li>
              <li>• Choose status and optional price</li>
              <li>• Click Apply to save</li>
              <li>• Booked dates (from stays) cannot be edited</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
