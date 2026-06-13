import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { registerSchema } from '@/lib/validation/common'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    parsed.error.errors.forEach((e) => { fields[e.path.join('.')] = e.message })
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields } }, { status: 400 })
  }

  const { name, email, password, phone, isHost } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: { code: 'EMAIL_TAKEN', message: 'Email already registered', fields: { email: 'Email already in use' } } },
      { status: 409 },
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { name, email, passwordHash, phone, isHost: isHost ?? false },
    select: { id: true, name: true, email: true, isHost: true, createdAt: true },
  })

  return NextResponse.json({ data: user }, { status: 201 })
}
