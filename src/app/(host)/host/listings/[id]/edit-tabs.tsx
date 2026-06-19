'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PhotoUploader } from '@/components/listings/photo-uploader'
import { ListingCalendar } from '@/components/calendar/listing-calendar'
import { cn } from '@/lib/utils'
import { ArrowLeft, Globe, Archive } from 'lucide-react'
import Link from 'next/link'

type Photo = { id: string; url: string; thumbUrl: string | null; sortOrder: number; key: string; thumbKey: string | null; isCover: boolean; listingId: string }
type Amenity = { id: string; name: string; category: string | null; icon: string | null }
type Listing = {
  id: string
  title: string
  description: string | null
  addressText: string
  basePrice: number | { toFixed: (n: number) => string }
  currency: string
  bedrooms: number
  bathrooms: number
  maxGuests: number
  checkInTime: string
  checkOutTime: string
  minStay: number
  maxStay: number | null
  status: string
  photos: Photo[]
  listingAmenities: { amenityId: string }[]
}

interface EditListingTabsProps {
  listing: Listing
  amenities: Amenity[]
}

export function EditListingTabs({ listing, amenities }: EditListingTabsProps) {
  const router = useRouter()
  const [photos, setPhotos] = useState<Photo[]>(listing.photos)
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(
    new Set(listing.listingAmenities.map((a) => a.amenityId))
  )
  const [details, setDetails] = useState({
    title: listing.title,
    description: listing.description ?? '',
    bedrooms: String(listing.bedrooms),
    bathrooms: String(listing.bathrooms),
    maxGuests: String(listing.maxGuests),
  })
  const [pricing, setPricing] = useState({
    basePrice: String(typeof listing.basePrice === 'object' ? listing.basePrice.toFixed(2) : listing.basePrice),
    currency: listing.currency,
    checkInTime: listing.checkInTime,
    checkOutTime: listing.checkOutTime,
    minStay: String(listing.minStay),
    maxStay: listing.maxStay ? String(listing.maxStay) : '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  async function saveDetails() {
    setSaving(true)
    setSaveMsg('')
    const res = await fetch(`/api/listings/${listing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: details.title,
        description: details.description || undefined,
        bedrooms: Number(details.bedrooms),
        bathrooms: Number(details.bathrooms),
        maxGuests: Number(details.maxGuests),
      }),
    })
    setSaving(false)
    setSaveMsg(res.ok ? 'Saved' : 'Save failed')
  }

  async function savePricing() {
    setSaving(true)
    setSaveMsg('')
    const res = await fetch(`/api/listings/${listing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basePrice: Number(pricing.basePrice),
        currency: pricing.currency,
        checkInTime: pricing.checkInTime,
        checkOutTime: pricing.checkOutTime,
        minStay: Number(pricing.minStay),
        maxStay: pricing.maxStay ? Number(pricing.maxStay) : undefined,
      }),
    })
    setSaving(false)
    setSaveMsg(res.ok ? 'Saved' : 'Save failed')
  }

  async function saveAmenities() {
    setSaving(true)
    setSaveMsg('')
    const res = await fetch(`/api/listings/${listing.id}/amenities`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amenityIds: Array.from(selectedAmenities) }),
    })
    setSaving(false)
    setSaveMsg(res.ok ? 'Saved' : 'Save failed')
  }

  async function doAction(action: 'publish' | 'archive') {
    setActionMsg('')
    const res = await fetch(`/api/listings/${listing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const json = await res.json()
    if (res.ok) {
      router.refresh()
    } else {
      const err = json.error as { message?: string; fields?: string[] }
      setActionMsg(err.fields?.join(', ') ?? err.message ?? 'Error')
    }
  }

  const grouped = amenities.reduce<Record<string, Amenity[]>>((acc, a) => {
    const cat = a.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(a)
    return acc
  }, {})

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/host/listings" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold flex-1 truncate">{listing.title}</h1>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          listing.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
          listing.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-700'
        )}>
          {listing.status}
        </span>
      </div>

      {/* publish / archive actions */}
      <div className="mb-4 flex gap-2">
        {listing.status !== 'PUBLISHED' && (
          <Button size="sm" onClick={() => doAction('publish')}>
            <Globe className="mr-2 h-3 w-3" /> Publish
          </Button>
        )}
        {listing.status !== 'ARCHIVED' && (
          <Button size="sm" variant="outline" onClick={() => doAction('archive')}>
            <Archive className="mr-2 h-3 w-3" /> Archive
          </Button>
        )}
      </div>
      {actionMsg && <p className="mb-4 text-sm text-destructive">{actionMsg}</p>}

      <Tabs defaultValue="details">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        {/* ── Details ── */}
        <TabsContent value="details" className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="d-title">Title</Label>
            <Input id="d-title" value={details.title} onChange={(e) => setDetails((d) => ({ ...d, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-desc">Description</Label>
            <Textarea id="d-desc" rows={6} value={details.description} onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['bedrooms', 'bathrooms', 'maxGuests'] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k}>{k === 'maxGuests' ? 'Max guests' : k.charAt(0).toUpperCase() + k.slice(1)}</Label>
                <Input id={k} type="number" min={0} value={details[k]} onChange={(e) => setDetails((d) => ({ ...d, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <SaveBar saving={saving} msg={saveMsg} onSave={saveDetails} />
        </TabsContent>

        {/* ── Photos ── */}
        <TabsContent value="photos">
          <PhotoUploader
            listingId={listing.id}
            photos={photos}
            onChange={setPhotos}
          />
        </TabsContent>

        {/* ── Amenities ── */}
        <TabsContent value="amenities" className="space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((a) => {
                  const active = selectedAmenities.has(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAmenities((prev) => {
                          const next = new Set(prev)
                          if (active) { next.delete(a.id) } else { next.add(a.id) }
                          return next
                        })
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background hover:bg-muted'
                      )}
                    >
                      {a.icon && <span className="mr-1">{a.icon}</span>}
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {amenities.length === 0 && (
            <p className="text-sm text-muted-foreground">No amenities in database yet.</p>
          )}
          <SaveBar saving={saving} msg={saveMsg} onSave={saveAmenities} />
        </TabsContent>

        {/* ── Pricing ── */}
        <TabsContent value="pricing" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="basePrice">Price per night</Label>
              <Input id="basePrice" type="number" min={0} step={0.01} value={pricing.basePrice} onChange={(e) => setPricing((p) => ({ ...p, basePrice: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} value={pricing.currency} onChange={(e) => setPricing((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="checkIn">Check-in time</Label>
              <Input id="checkIn" type="time" value={pricing.checkInTime} onChange={(e) => setPricing((p) => ({ ...p, checkInTime: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="checkOut">Check-out time</Label>
              <Input id="checkOut" type="time" value={pricing.checkOutTime} onChange={(e) => setPricing((p) => ({ ...p, checkOutTime: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="minStay">Min stay (nights)</Label>
              <Input id="minStay" type="number" min={1} value={pricing.minStay} onChange={(e) => setPricing((p) => ({ ...p, minStay: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxStay">Max stay (nights, optional)</Label>
              <Input id="maxStay" type="number" min={1} value={pricing.maxStay} onChange={(e) => setPricing((p) => ({ ...p, maxStay: e.target.value }))} />
            </div>
          </div>
          <SaveBar saving={saving} msg={saveMsg} onSave={savePricing} />
        </TabsContent>

        {/* ── Calendar ── */}
        <TabsContent value="calendar">
          <ListingCalendar listingId={listing.id} basePrice={typeof listing.basePrice === 'object'
            ? (listing.basePrice as { toFixed: (n: number) => string }).toFixed(2)
            : String(listing.basePrice)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SaveBar({ saving, msg, onSave }: { saving: boolean; msg: string; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
      {msg && <span className={cn('text-sm', msg === 'Saved' ? 'text-green-600' : 'text-destructive')}>{msg}</span>}
    </div>
  )
}
