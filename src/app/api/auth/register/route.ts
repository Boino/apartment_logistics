import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
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
  const verifyToken = randomBytes(32).toString('hex')
  const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone,
      isHost: isHost ?? false,
      verifyToken,
      verifyTokenExpiry,
    },
  })

  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const verifyLink = `${appUrl}/api/auth/verify-email?token=${verifyToken}`

  sendEmail({
    to: email,
    subject: 'Verify your StayBase account',
    template: 'verify-email',
    data: { name, verifyLink },
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
        <h2 style="color:#1d7464">Welcome to StayBase, ${name}!</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <p style="margin:32px 0">
          <a href="${verifyLink}"
             style="background:#1d7464;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Verify my email
          </a>
        </p>
        <p style="color:#666;font-size:13px">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">
          Or copy this URL into your browser:<br/>${verifyLink}
        </p>
      </div>
    `,
  }).catch((err) => console.error('[verify email]', err))

  return NextResponse.json(
    { data: { message: 'Account created. Check your email to verify and activate it.' } },
    { status: 201 },
  )
}
