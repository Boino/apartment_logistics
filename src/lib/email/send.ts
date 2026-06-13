import { Resend } from 'resend'

export interface EmailPayload {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
  html?: string
}

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

function renderFallbackHtml(payload: EmailPayload): string {
  return payload.html ?? `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>StayBase</h2>
      <p><strong>Template:</strong> ${payload.template}</p>
      <pre style="background:#f5f5f5;padding:12px;border-radius:4px">${JSON.stringify(payload.data, null, 2)}</pre>
    </div>
  `
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const client = getResend()

  if (!client) {
    // Console transport fallback when RESEND_API_KEY is not set
    console.log('\n📧 [EMAIL — console transport]')
    console.log(`  To:       ${payload.to}`)
    console.log(`  Subject:  ${payload.subject}`)
    console.log(`  Template: ${payload.template}`)
    console.log(`  Data:`, JSON.stringify(payload.data, null, 2))
    return
  }

  const from = process.env.EMAIL_FROM ?? 'StayBase <noreply@staybase.app>'
  const { error } = await client.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: renderFallbackHtml(payload),
  })

  if (error) {
    console.error('[email] Resend error:', error)
    throw new Error(`Email delivery failed: ${error.message}`)
  }
}
