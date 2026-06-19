import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getLogistics, seedDefaults } from '@/modules/logistics/service'
import { LogisticsPanel } from '@/modules/logistics/ui'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Logistics' }

type Props = { searchParams: { listingId?: string } }

export default async function HostLogisticsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const listings = await db.listing.findMany({
    where: { hostId: session.user.id, status: { not: 'ARCHIVED' } },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  })

  if (listings.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Logistics</h1>
        <div className="flex flex-col items-center py-24 text-center text-muted-foreground gap-3">
          <p className="text-lg font-medium">No listings yet</p>
          <p className="text-sm">Create and publish a listing to start tracking inventory.</p>
          <Button asChild variant="outline"><Link href="/host/listings/new">Create listing</Link></Button>
        </div>
      </div>
    )
  }

  const activeId = searchParams.listingId ?? listings[0].id

  let data = null
  try {
    // seed defaults for new listings
    await seedDefaults(activeId)
    data = await getLogistics(activeId, session.user.id)
  } catch {
    redirect('/host/logistics')
  }

  const serialized = {
    linenSets: data!.linenSets.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
    consumables: data!.consumables.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })),
    damageReports: data!.damageReports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Logistics</h1>

      {/* Listing selector */}
      {listings.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/host/logistics?listingId=${l.id}`}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${activeId === l.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
            >
              {l.title}
            </Link>
          ))}
        </div>
      )}

      {serialized.damageReports.length > 0 && (
        <p className="text-sm text-destructive font-medium mb-4">
          {serialized.damageReports.length} open damage report{serialized.damageReports.length !== 1 ? 's' : ''} — see below
        </p>
      )}

      <LogisticsPanel
        listingId={activeId}
        initialData={serialized}
        readonly={false}
      />
    </div>
  )
}

