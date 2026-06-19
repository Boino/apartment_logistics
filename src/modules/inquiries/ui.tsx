'use client'

import { InquiryForm } from '@/components/listings/inquiry-form'

export interface InquiryEntryProps {
  listingId: string
  basePrice: number
  currency: string
  minStay: number
  maxStay?: number | null
  maxGuests: number
  checkInTime: string
  checkOutTime: string
}

export function InquiryEntry(props: InquiryEntryProps) {
  return <InquiryForm {...props} />
}
