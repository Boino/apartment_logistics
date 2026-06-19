import { Resend } from 'resend'
import nodemailer from 'nodemailer'

export interface EmailPayload {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
  html?: string
}

// ── Resend ────────────────────────────────────────────────────────────────────
let resendClient: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

// ── SMTP (nodemailer) ─────────────────────────────────────────────────────────
function getSmtpTransport(): nodemailer.Transporter | null {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildHtml(payload: EmailPayload): string {
  return payload.html ?? `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>StayBase</h2>
      <p><strong>Template:</strong> ${payload.template}</p>
      <pre style="background:#f5f5f5;padding:12px;border-radius:4px">${JSON.stringify(payload.data, null, 2)}</pre>
    </div>
  `
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'StayBase <noreply@staybase.app>'
  const html = buildHtml(payload)

  // 1. Try Resend
  const resend = getResend()
  if (resend) {
    const { error } = await resend.emails.send({ from, to: payload.to, subject: payload.subject, html })
    if (error) throw new Error(`Resend error: ${error.message}`)
    return
  }

  // 2. Try SMTP (nodemailer)
  const smtp = getSmtpTransport()
  if (smtp) {
    await smtp.sendMail({ from, to: payload.to, subject: payload.subject, html })
    return
  }

  // 3. Console fallback (dev only)
  console.log('\n📧 [EMAIL — console transport]')
  console.log(`  To:       ${payload.to}`)
  console.log(`  Subject:  ${payload.subject}`)
  console.log(`  Template: ${payload.template}`)
  console.log(`  Data:`, JSON.stringify(payload.data, null, 2))
}
