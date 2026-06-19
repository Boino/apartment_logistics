import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { NewStayForm } from './new-stay-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New Stay' }

type Props = { searchParams: { inquiryId?: string } }

export default async function NewStayPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const listings = await db.listing.findMany({
    where: { hostId: session.user.id, status: 'PUBLISHED' },
    select: { id: true, title: true, checkInTime: true, checkOutTime: true },
    orderBy: { title: 'asc' },
  })

  let prefill: {
    listingId: string; listingTitle: string; guestName: string; numGuests: number
    inquiryId: string; checkinDate: string; checkoutDate: string
  } | null = null

  if (searchParams.inquiryId) {
    const inquiry = await db.inquiry.findUnique({
      where: { id: searchParams.inquiryId },
      include: {
        listing: { select: { id: true, title: true, hostId: true, checkInTime: true, checkOutTime: true } },
        guest: { select: { name: true } },
      },
    })
    if (inquiry && inquiry.listing.hostId === session.user.id) {
      const ci = new Date(inquiry.checkinDate)
      const co = new Date(inquiry.checkoutDate)
      const [ciH, ciM] = inquiry.listing.checkInTime.split(':')
      const [coH, coM] = inquiry.listing.checkOutTime.split(':')
      ci.setUTCHours(Number(ciH), Number(ciM), 0, 0)
      co.setUTCHours(Number(coH), Number(coM), 0, 0)
      prefill = {
        listingId: inquiry.listingId,
        listingTitle: inquiry.listing.title,
        guestName: inquiry.guest.name,
        numGuests: inquiry.numGuests,
        inquiryId: inquiry.id,
        checkinDate: ci.toISOString().slice(0, 16),
        checkoutDate: co.toISOString().slice(0, 16),
      }
    }
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{prefill ? 'Convert inquiry to stay' : 'New stay'}</h1>
      <NewStayForm listings={listings} prefill={prefill} />
    </div>
  )
}
