export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAmenityCatalog } from '@/modules/listings/service'

export async function GET() {
  try {
    const amenities = await getAmenityCatalog()
    return NextResponse.json({ data: amenities })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}
