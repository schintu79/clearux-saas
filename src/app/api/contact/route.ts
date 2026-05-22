import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Lazy Resend client — defer construction so module-import-time stays safe
// when RESEND_API_KEY is not set (e.g. during `next build` page-data
// collection). Matches the pattern used in src/lib/audit-engine/email.ts.
let _resend: Resend | null = null
function getResend(): Resend | null {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  _resend = new Resend(key)
  return _resend
}

const CONTACT_TO = 'support@fixpath.ai'

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 },
      )
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 },
      )
    }

    const resend = getResend()
    if (!resend) {
      console.warn('[contact] RESEND_API_KEY not set — refusing to send')
      return NextResponse.json(
        { error: 'Contact form is temporarily unavailable. Please email support directly.' },
        { status: 503 },
      )
    }

    const { error } = await resend.emails.send({
      from: `Fixpath Contact <hello@fixpath.ai>`,
      to: CONTACT_TO,
      reply_to: email,
      subject: `Contact form: ${name}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="font-size:18px;color:#111;margin:0 0 20px">New contact form submission</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:10px 0;color:#71717a;border-bottom:1px solid #f0f0f0;width:80px;vertical-align:top">Name</td>
              <td style="padding:10px 0;font-weight:600;color:#111;border-bottom:1px solid #f0f0f0">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#71717a;border-bottom:1px solid #f0f0f0;vertical-align:top">Email</td>
              <td style="padding:10px 0;font-weight:600;color:#111;border-bottom:1px solid #f0f0f0"><a href="mailto:${escapeHtml(email)}" style="color:#111">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#71717a;vertical-align:top">Message</td>
              <td style="padding:10px 0;color:#3f3f46;white-space:pre-wrap">${escapeHtml(message)}</td>
            </tr>
          </table>
        </div>
      `,
    })

    if (error) {
      console.error('Contact form email error:', error)
      return NextResponse.json(
        { error: 'Failed to send message. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
