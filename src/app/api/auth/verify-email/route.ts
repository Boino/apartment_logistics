import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  console.log('[verify-email] START token=', token?.slice(0, 12))

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?error=missing-token`)
  }

  try {
    // Raw SQL to bypass any Prisma schema cache issues
    const rows = await db.$queryRawUnsafe<Array<{
      id: string; email: string; verifyToken: string | null; verifyTokenExpiry: string | null
    }>>(
      `SELECT id, email, verifyToken, verifyTokenExpiry FROM "User" WHERE verifyToken = ?`,
      token,
    )

    console.log('[verify-email] raw rows found:', rows.length)

    if (rows.length === 0) {
      console.log('[verify-email] no user found for token')
      return NextResponse.redirect(`${appUrl}/login?error=invalid-token`)
    }

    const row = rows[0]
    const expiry = row.verifyTokenExpiry ? new Date(row.verifyTokenExpiry) : null
    if (!expiry || expiry < new Date()) {
      return NextResponse.redirect(`${appUrl}/login?error=expired-token`)
    }

    await db.user.update({
      where: { id: row.id },
      data: { emailVerified: new Date(), verifyToken: null, verifyTokenExpiry: null },
    })

    console.log('[verify-email] verified user:', row.email)
    return NextResponse.redirect(`${appUrl}/login?verified=1`)
  } catch (err) {
    console.error('[verify-email] error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=server-error`)
  }
}
