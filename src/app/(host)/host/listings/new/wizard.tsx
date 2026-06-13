'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STEPS = ['Details', 'Location & Pricing', 'Review'] as const

type FormData = {
  title: string
  description: string
  addressText: string
  basePrice: string
  bedrooms: string
  bathrooms: string
  maxGuests: string
  checkInTime: string
  checkOutTime: string
  minStay: string
}

const EMPTY: FormData = {
  title: '',
  description: '',
  addressText: '',
  basePrice: '',
  bedrooms: '1',
  bathrooms: '1',
  maxGuests: '2',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  minStay: '1',
}

export function NewListingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | '_', string>>>({})
  const [saving, setSaving] = useState(false)

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validateStep(): boolean {
    const e: typeof errors = {}
    if (step === 0) {
      if (!form.title.trim()) e.title = 'Title is required'
      if (form.description.trim().length > 0 && form.description.trim().length < 50)
        e.description = 'Description must be at least 50 characters or left empty'
    }
    if (step === 1) {
      if (!form.addressText.trim()) e.addressText = 'Address is required'
      if (!form.basePrice || Number(form.basePrice) <= 0) e.basePrice = 'Price must be positive'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validateStep()) return
    setSaving(true)
    setErrors({})

    const body = {
      title: form.title,
      description: form.description || undefined,
      addressText: form.addressText,
      basePrice: Number(form.basePrice),
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      maxGuests: Number(form.maxGuests),
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      minStay: Number(form.minStay),
    }

    let res: Response, json: Record<string, unknown> = {}
    try {
      res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      json = await res.json()
    } catch {
      setErrors({ _: 'Could not reach the server.' })
      setSaving(false)
      return
    }

    if (!res.ok) {
      const err = (json.error as { message?: string; fields?: Record<string, string[]> }) ?? {}
      setErrors({ _: err.message ?? 'Unknown error' })
      setSaving(false)
      return
    }

    const listing = (json.data as { id: string })
    router.push(`/host/listings/${listing.id}`)
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* step indicator */}
      <div className="mb-8 flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                i <= step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {i + 1}
            </div>
            <span className={cn('text-sm', i === step ? 'font-medium' : 'text-muted-foreground')}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Cozy apartment in the city centre"
                  maxLength={120}
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Describe your space (min 50 chars to publish)…"
                  rows={5}
                />
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    min={0}
                    max={50}
                    value={form.bedrooms}
                    onChange={(e) => set('bedrooms', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    min={0}
                    max={50}
                    value={form.bathrooms}
                    onChange={(e) => set('bathrooms', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxGuests">Max guests</Label>
                  <Input
                    id="maxGuests"
                    type="number"
                    min={1}
                    max={100}
                    value={form.maxGuests}
                    onChange={(e) => set('maxGuests', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1">
                <Label htmlFor="addressText">Address *</Label>
                <Input
                  id="addressText"
                  value={form.addressText}
                  onChange={(e) => set('addressText', e.target.value)}
                  placeholder="123 Main Street, City, Country"
                />
                {errors.addressText && <p className="text-xs text-destructive">{errors.addressText}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="basePrice">Price per night (EUR) *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  min={1}
                  step={0.01}
                  value={form.basePrice}
                  onChange={(e) => set('basePrice', e.target.value)}
                  placeholder="85"
                />
                {errors.basePrice && <p className="text-xs text-destructive">{errors.basePrice}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="checkInTime">Check-in time</Label>
                  <Input
                    id="checkInTime"
                    type="time"
                    value={form.checkInTime}
                    onChange={(e) => set('checkInTime', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkOutTime">Check-out time</Label>
                  <Input
                    id="checkOutTime"
                    type="time"
                    value={form.checkOutTime}
                    onChange={(e) => set('checkOutTime', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="minStay">Minimum stay (nights)</Label>
                <Input
                  id="minStay"
                  type="number"
                  min={1}
                  max={365}
                  value={form.minStay}
                  onChange={(e) => set('minStay', e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3 text-sm">
              <ReviewRow label="Title" value={form.title} />
              <ReviewRow label="Description" value={form.description || '—'} />
              <ReviewRow label="Address" value={form.addressText} />
              <ReviewRow label="Price / night" value={`EUR ${form.basePrice}`} />
              <ReviewRow label="Bedrooms" value={form.bedrooms} />
              <ReviewRow label="Bathrooms" value={form.bathrooms} />
              <ReviewRow label="Max guests" value={form.maxGuests} />
              <ReviewRow label="Check-in" value={form.checkInTime} />
              <ReviewRow label="Check-out" value={form.checkOutTime} />
              <ReviewRow label="Min stay" value={`${form.minStay} night(s)`} />
              <p className="mt-2 text-muted-foreground">
                After saving, you can add photos and amenities, then publish the listing.
              </p>
            </div>
          )}

          {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => (step === 0 ? router.push('/host/listings') : setStep((s) => s - 1))}
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {isLast ? (
              <Button onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Create listing'}
              </Button>
            ) : (
              <Button onClick={() => { if (validateStep()) setStep((s) => s + 1) }}>
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
