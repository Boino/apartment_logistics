'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GuestCalendar } from '@/components/calendar/guest-calendar'
import { Button } from '@/components/ui/button'
import { Users, Calendar, Tag } from 'lucide-react'
import { calcStayPrice } from '@/modules/inquiries/pricing'

interface InquiryFormProps {
  listingId: string
  basePrice: number
  currency: string
  minStay: number
  maxStay?: number | null
  maxGuests: number
  checkInTime: string
  checkOutTime: string
}

export function InquiryForm({
  listingId, basePrice, currency, minStay, maxStay, maxGuests, checkInTime, checkOutTime,
}: InquiryFormProps) {
  const router = useRouter()
  const [checkin, setCheckin] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<string | null>(null)
  const [nights, setNights] = useState(0)
  const [pricePerNight, setPricePerNight] = useState(basePrice)
  const [numGuests, setNumGuests] = useState(1)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [calendarKey, setCalendarKey] = useState(0)

  function handleRangeSelected(ci: string, co: string, n: number, ppn: number) {
    setCheckin(ci); setCheckout(co); setNights(n); setPricePerNight(ppn)
    setError(null)
  }

  function clearDates() {
    setCheckin(null); setCheckout(null); setNights(0)
    setCalendarKey((k) => k + 1) // remount calendar to clear its internal selection
  }

  const { subtotal, discountPct, total } = nights > 0
    ? calcStayPrice(pricePerNight, nights)
    : { subtotal: 0, discountPct: 0, total: 0 }

  async function submit() {
    if (!checkin || !checkout) { setError('Please select check-in and check-out dates'); return }
    if (!message.trim() || message.trim().length < 10) { setError('Message must be at least 10 characters'); return }
    setSubmitting(true); setError(null)

    let res: Response, json: Record<string, unknown> = {}
    try {
      res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, checkinDate: checkin, checkoutDate: checkout, numGuests, message }),
      })
      json = await res.json()
    } catch {
      setError('Network error — please try again'); setSubmitting(false); return
    }

    if (!res.ok) {
      const code = (json.error as { code?: string })?.code
      if (code === 'UNAUTHORIZED') {
        router.push(`/login?callbackUrl=/listings/${listingId}`)
        return
      }
      setError((json.error as { message?: string })?.message ?? 'Something went wrong')
      setSubmitting(false); return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="rounded-xl border bg-green-50 p-6 text-center">
        <p className="text-xl font-semibold text-green-700">Inquiry sent!</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The host has been notified by email and will reply in the chat thread.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => setSuccess(false)}>
          Send another inquiry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Calendar ── */}
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 font-semibold">Select dates</h3>
        <GuestCalendar
          key={calendarKey}
          listingId={listingId}
          basePrice={basePrice}
          minStay={minStay}
          maxStay={maxStay}
          onRangeSelected={handleRangeSelected}
          onCleared={clearDates}
        />
      </div>

      {/* ── Price summary ── */}
      {checkin && checkout ? (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <span><strong>{checkin}</strong> → <strong>{checkout}</strong> ({nights} night{nights !== 1 ? 's' : ''})</span>
            <button type="button" onClick={clearDates} className="ml-auto text-xs text-muted-foreground underline">Clear</button>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{currency} {pricePerNight.toFixed(0)} × {nights} nights</span>
              <span>{currency} {subtotal.toFixed(2)}</span>
            </div>
            {discountPct > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{discountPct}% long-stay discount</span>
                <span>−{currency} {(subtotal - total).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Estimated total</span>
              <span>{currency} {total.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Check-in from {checkInTime} · Check-out by {checkOutTime}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Select dates on the calendar to see pricing.
          {minStay > 1 && ` Minimum stay: ${minStay} nights.`}
        </p>
      )}

      {/* ── Guests ── */}
      <div className="flex items-center gap-3">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <label className="text-sm font-medium" htmlFor="guests">Guests</label>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setNumGuests((n) => Math.max(1, n - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full border text-sm hover:bg-muted"
          >−</button>
          <span className="w-6 text-center text-sm font-medium">{numGuests}</span>
          <button
            type="button"
            onClick={() => setNumGuests((n) => Math.min(maxGuests, n + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full border text-sm hover:bg-muted"
          >+</button>
          <span className="text-xs text-muted-foreground">(max {maxGuests})</span>
        </div>
      </div>

      {/* ── Message ── */}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="msg">Message to host</label>
        <textarea
          id="msg"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Introduce yourself and mention anything relevant — arrival time, pets, special occasion…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? 'Sending…' : 'Send inquiry'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You won&apos;t be charged yet — this is just a message to the host.
      </p>
    </div>
  )
}
