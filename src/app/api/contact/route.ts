import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const CONTACT_TO = 'support@clearux.ai'

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

    const { error } = await resend.emails.send({
      from: `ClearUX Contact <hello@clearux.ai>`,
      to: CONTACT_TO,
      replyTo: email,
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
