import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import { getGuestInquiries } from '@/modules/inquiries/service'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Inquiries' }

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open', ANSWERED: 'Answered', CONFIRMED: 'Confirmed',
  DECLINED: 'Declined', CLOSED: 'Closed',
}
const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'default', ANSWERED: 'secondary', CONFIRMED: 'default',
  DECLINED: 'destructive', CLOSED: 'outline',
}

export default async function GuestInquiriesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login?callbackUrl=/inquiries')

  const inquiries = await getGuestInquiries(session.user.id)

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Inquiries</h1>

      {inquiries.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center text-muted-foreground gap-3">
          <p className="text-lg font-medium">No inquiries yet</p>
          <p className="text-sm">Browse listings and send your first inquiry.</p>
          <Link href="/" className="text-primary underline text-sm">Browse listings</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => {
            const lastMsg = inq.thread?.messages?.[0]
            const coverUrl = inq.listing.photos?.[0]?.url
            const checkin = format(parseISO(new Date(inq.checkinDate).toISOString().slice(0, 10)), 'dd MMM yyyy')
            const checkout = format(parseISO(new Date(inq.checkoutDate).toISOString().slice(0, 10)), 'dd MMM yyyy')

            return (
              <Link
                key={inq.id}
                href={inq.thread ? `/inquiries/${inq.thread.id}` : '#'}
                className="flex gap-4 rounded-xl border p-4 hover:bg-muted/40 transition-colors"
              >
                {coverUrl && (
                  <div className="relative h-16 w-24 shrink-0">
                    <Image src={coverUrl} alt="" fill className="rounded-lg object-cover" sizes="96px" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="font-semibold truncate">{inq.listing.title}</p>
                    <Badge variant={STATUS_VARIANTS[inq.status] ?? 'outline'}>
                      {STATUS_LABELS[inq.status] ?? inq.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {checkin} → {checkout} · {inq.numGuests} guest{inq.numGuests !== 1 ? 's' : ''}
                  </p>
                  {lastMsg && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {lastMsg.body}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
