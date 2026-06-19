import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getHostInquiries } from '@/modules/inquiries/service'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inquiries' }

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open', ANSWERED: 'Answered', CONFIRMED: 'Confirmed',
  DECLINED: 'Declined', CLOSED: 'Closed',
}
const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'default', ANSWERED: 'secondary', CONFIRMED: 'default',
  DECLINED: 'destructive', CLOSED: 'outline',
}

type Props = { searchParams: { listingId?: string; status?: string } }

export default async function HostInquiriesPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const inquiries = await getHostInquiries(
    session.user.id,
    searchParams.listingId,
    searchParams.status,
  )

  const statuses = ['OPEN', 'ANSWERED', 'CONFIRMED', 'DECLINED', 'CLOSED']

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Inquiries</h1>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/host/inquiries"
          className={`rounded-full px-3 py-1 text-sm border transition-colors ${!searchParams.status ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/host/inquiries?status=${s}`}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${searchParams.status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {inquiries.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center text-muted-foreground gap-2">
          <p className="text-lg font-medium">No inquiries</p>
          <p className="text-sm">
            {searchParams.status ? `No ${STATUS_LABELS[searchParams.status]?.toLowerCase()} inquiries.` : 'Guests will appear here once they send an inquiry.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => {
            const lastMsg = inq.thread?.messages?.[0]
            const checkin = format(parseISO(new Date(inq.checkinDate).toISOString().slice(0, 10)), 'dd MMM yyyy')
            const checkout = format(parseISO(new Date(inq.checkoutDate).toISOString().slice(0, 10)), 'dd MMM yyyy')

            return (
              <Link
                key={inq.id}
                href={`/host/inquiries/${inq.id}`}
                className="flex gap-4 rounded-xl border p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold">{inq.guest.name}</p>
                      <p className="text-xs text-muted-foreground">{inq.guest.email}</p>
                    </div>
                    <Badge variant={STATUS_VARIANTS[inq.status] ?? 'outline'}>
                      {STATUS_LABELS[inq.status] ?? inq.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {inq.listing.title} · {checkin} → {checkout} · {inq.numGuests} guest{inq.numGuests !== 1 ? 's' : ''}
                  </p>
                  {lastMsg && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{lastMsg.body}</p>
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
