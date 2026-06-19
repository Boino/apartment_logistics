export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { runHourlyCron } from '@/modules/stays/service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Invalid cron secret' } }, { status: 403 })
  }
  try {
    const result = await runHourlyCron()
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[cron:hourly]', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Cron failed' } }, { status: 500 })
  }
}
