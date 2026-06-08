// ============================================================
// Fixpath API — /api/contact/enterprise
// POST → Enterprise plan inquiry — sends formatted email to Fixpath
// ============================================================

import { NextResponse } from 'next/server'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  _resend = new Resend(key)
  return _resend
}

const ENTERPRISE_TO = 'support@fixpath.ai'

export async function POST(req: Request) {
  try {
    const { name, email, company, note } = await req.json()

    if (!name || !email || !company) {
      return NextResponse.json(
        { error: 'Name, email, and company are required.' },
        { status: 400 },
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 },
      )
    }

    const resend = getResend()
    if (!resend) {
      console.warn('[enterprise-contact] RESEND_API_KEY not set — refusing to send')
      return NextResponse.json(
        { error: 'Contact form is temporarily unavailable. Please email support@fixpath.ai directly.' },
        { status: 503 },
      )
    }

    const { error } = await resend.emails.send({
      from: 'Fixpath Enterprise <hello@fixpath.ai>',
      to: ENTERPRISE_TO,
      reply_to: email,
      subject: `Enterprise inquiry: ${escapeHtml(company)} — ${escapeHtml(name)}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="font-size:18px;color:#111;margin:0 0 8px">Enterprise plan inquiry</h2>
          <p style="font-size:13px;color:#71717a;margin:0 0 24px">Submitted from the pricing page</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:10px 0;color:#71717a;border-bottom:1px solid #f0f0f0;width:100px;vertical-align:top">Name</td>
              <td style="padding:10px 0;font-weight:600;color:#111;border-bottom:1px solid #f0f0f0">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#71717a;border-bottom:1px solid #f0f0f0;vertical-align:top">Email</td>
              <td style="padding:10px 0;font-weight:600;color:#111;border-bottom:1px solid #f0f0f0"><a href="mailto:${escapeHtml(email)}" style="color:#111">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#71717a;border-bottom:1px solid #f0f0f0;vertical-align:top">Company</td>
              <td style="padding:10px 0;font-weight:600;color:#111;border-bottom:1px solid #f0f0f0">${escapeHtml(company)}</td>
            </tr>
            ${note ? `
            <tr>
              <td style="padding:10px 0;color:#71717a;vertical-align:top">Note</td>
              <td style="padding:10px 0;color:#3f3f46;white-space:pre-wrap">${escapeHtml(note)}</td>
            </tr>
            ` : ''}
          </table>
        </div>
      `,
    })

    if (error) {
      console.error('Enterprise contact email error:', error)
      return NextResponse.json(
        { error: 'Failed to send message. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Enterprise contact error:', err)
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
