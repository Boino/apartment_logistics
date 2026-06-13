import { getPublishedListings } from '@/modules/listings/service'
import { ListingCard } from '@/components/listings/listing-card'
import { Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Props = { searchParams: { q?: string; min?: string; max?: string; page?: string } }

export default async function HomePage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const take = 12
  const skip = (page - 1) * take

  let listings: Awaited<ReturnType<typeof getPublishedListings>>['listings'] = []
  let total = 0
  let dbError = false

  try {
    const result = await getPublishedListings({
      search: searchParams.q,
      minPrice: searchParams.min ? Number(searchParams.min) : undefined,
      maxPrice: searchParams.max ? Number(searchParams.max) : undefined,
      take,
      skip,
    })
    listings = result.listings
    total = result.total
  } catch {
    dbError = true
  }

  const totalPages = Math.ceil(total / take)

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* ── Hero / search bar ── */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Find your next stay</h1>
        <p className="mt-3 text-lg text-muted-foreground">Handpicked apartments for short and long stays</p>
        <form method="GET" className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={searchParams.q}
              placeholder="City, neighbourhood…"
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
            />
          </div>
          <div className="flex gap-2">
            <input
              name="min"
              type="number"
              defaultValue={searchParams.min}
              placeholder="Min €"
              className="w-24 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              name="max"
              type="number"
              defaultValue={searchParams.max}
              placeholder="Max €"
              className="w-24 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Results ── */}
      {dbError ? (
        <div className="flex flex-col items-center py-24 text-center text-muted-foreground gap-2">
          <p>Database unavailable — start the dev server to see listings.</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center text-muted-foreground gap-2">
          <p className="text-lg font-medium">No listings found</p>
          {searchParams.q && <p className="text-sm">Try a different search term.</p>}
          {!searchParams.q && <p className="text-sm">No published listings yet — hosts can add them from the dashboard.</p>}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">{total} listing{total !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={{ ...listing, basePrice: Number(listing.basePrice) }}
                href={`/listings/${listing.id}`}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), page: String(p) }).toString()}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm ${p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
