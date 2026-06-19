'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type Listing = { id: string; title: string; checkInTime: string; checkOutTime: string }

type Prefill = {
  listingId: string; listingTitle: string; guestName: string; numGuests: number
  inquiryId: string; checkinDate: string; checkoutDate: string
} | null

export function NewStayForm({ listings, prefill }: { listings: Listing[]; prefill: Prefill }) {
  const router = useRouter()
  const [listingId, setListingId] = useState(prefill?.listingId ?? listings[0]?.id ?? '')
  const [guestName, setGuestName] = useState(prefill?.guestName ?? '')
  const [numGuests, setNumGuests] = useState(prefill?.numGuests ?? 1)
  const [checkinAt, setCheckinAt] = useState(prefill?.checkinDate ?? '')
  const [checkoutAt, setCheckoutAt] = useState(prefill?.checkoutDate ?? '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConvert = !!prefill

  async function submit() {
    if (!listingId || !guestName.trim() || !checkinAt || !checkoutAt) {
      setError('All fields are required'); return
    }
    setSubmitting(true); setError(null)

    const url = isConvert
      ? `/api/inquiries/${prefill!.inquiryId}/convert-to-stay`
      : `/api/listings/${listingId}/stays`

    const body = isConvert
      ? { checkinAt: new Date(checkinAt).toISOString(), checkoutAt: new Date(checkoutAt).toISOString(), notes: notes || undefined }
      : {
          guestName: guestName.trim(), numGuests, notes: notes || undefined,
          checkinAt: new Date(checkinAt).toISOString(),
          checkoutAt: new Date(checkoutAt).toISOString(),
        }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)

    setSubmitting(false)
    if (!res) { setError('Network error'); return }
    const json = await res.json()
    if (!res.ok) { setError(json.error?.message ?? 'Something went wrong'); return }
    router.push('/host/stays')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {!isConvert && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Listing</label>
          <select
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
      )}

      {isConvert && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{prefill!.listingTitle}</p>
          <p className="text-muted-foreground">Converting inquiry from {prefill!.guestName} · {prefill!.numGuests} guest{prefill!.numGuests !== 1 ? 's' : ''}</p>
        </div>
      )}

      {!isConvert && (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium">Guest name</label>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest full name"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Number of guests</label>
            <input
              type="number" min={1} value={numGuests}
              onChange={(e) => setNumGuests(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Check-in</label>
          <input
            type="datetime-local" value={checkinAt}
            onChange={(e) => setCheckinAt(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Check-out</label>
          <input
            type="datetime-local" value={checkoutAt}
            onChange={(e) => setCheckoutAt(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
        <textarea
          rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes about this stay…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={submit} disabled={submitting} className="flex-1">
          {submitting ? 'Saving…' : isConvert ? 'Confirm stay' : 'Create stay'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/host/stays">Cancel</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        This will block the dates on the availability calendar.
      </p>
    </div>
  )
}
