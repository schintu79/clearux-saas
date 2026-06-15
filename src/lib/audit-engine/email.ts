// ============================================================
// ClearUX — Transactional Email Notifications via Resend
// Branded HTML templates for all transactional emails.
// ============================================================

import { Resend } from 'resend'

// Lazy Resend client. The SDK constructor throws synchronously when the API
// key is missing, which broke `next build` page-data collection in
// environments without RESEND_API_KEY (e.g. CI smoke builds). Defer client
// creation until a send is actually attempted so module-import-time stays
// safe, and short-circuit cleanly when the key is absent.
let _resend: Resend | null = null
function getResend(): Resend | null {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  _resend = new Resend(key)
  return _resend
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.fixpath.ai'

/* ── Shared template wrapper ─────────────────────────────────── */

function emailLayout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}</span>` : ''}
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; }
    .outer { width: 100%; background: #f4f4f5; padding: 40px 16px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .header { background: #111111; padding: 32px 32px 28px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 500; color: #ffffff; letter-spacing: -0.3px; }
    .header .logo { margin-bottom: 16px; }
    .body { padding: 32px; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.65; color: #3f3f46; }
    .body h2 { margin: 0 0 12px; font-size: 17px; font-weight: 500; color: #111111; }
    .btn { display: inline-block; background: #10B981; color: #ffffff !important; font-size: 15px; font-weight: 500; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin: 8px 0 16px; }
    .info-box { background: #f9fafb; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #71717a; }
    .info-value { font-weight: 500; color: #111111; }
    .pill { display: inline-block; font-size: 11px; font-weight: 500; padding: 4px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pill-green { background: rgba(34,197,94,0.1); color: #16a34a; }
    .pill-lime { background: rgba(16,185,129,0.15); color: #065f46; }
    .divider { height: 1px; background: #e4e4e7; margin: 24px 0; }
    .footer { padding: 24px 32px; text-align: center; font-size: 12px; color: #a1a1aa; line-height: 1.5; border-top: 1px solid #f0f0f0; }
    .footer a { color: #71717a; text-decoration: underline; }
    .check-list { list-style: none; padding: 0; margin: 16px 0; }
    .check-list li { padding: 6px 0; font-size: 14px; color: #3f3f46; }
    .check-list li::before { content: ""; display: inline-block; width: 16px; height: 16px; background: #22c55e; border-radius: 50%; margin-right: 10px; vertical-align: middle; }
  </style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <div class="logo"><a href="${APP_URL}"><img src="${APP_URL}/email-logo.png" alt="Fixpath" width="56" height="56" style="display:block;margin:0 auto;border-radius:12px;border:0" /></a></div>
        ${content.split('<!--HEADER-->')[0]}
      </div>
      <div class="body">
        ${content.split('<!--HEADER-->')[1]?.split('<!--FOOTER-->')[0] || ''}
      </div>
      <div class="footer">
        ${content.split('<!--FOOTER-->')[1] || `<p>&copy; ${new Date().getFullYear()} Fixpath. All rights reserved.</p><p><a href="${APP_URL}">fixpath.ai</a> &middot; <a href="${APP_URL}/contact">Contact support</a></p>`}
      </div>
    </div>
  </div>
</body>
</html>`
}

/* ── Helper to send ────────────────────────────────────────── */

async function send(
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getResend()
    if (!client) {
      console.warn(`[email] RESEND_API_KEY not set — skipping send: ${subject} → ${to}`)
      return { success: false, error: 'RESEND_API_KEY not configured' }
    }
    const { error } = await client.emails.send({ from, to, subject, html })
    if (error) {
      console.error('Resend email error:', error)
      return { success: false, error: error.message }
    }
    console.log(`Email sent to ${to}: ${subject}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Failed to send email "${subject}" to ${to}:`, message)
    return { success: false, error: message }
  }
}

/* ═══════════════════════════════════════════════════════════════
   1. WELCOME EMAIL — sent after email confirmation
   ═══════════════════════════════════════════════════════════════ */

export async function sendWelcomeEmail(
  email: string,
  fullName?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const name = fullName || 'there'
  const dashboardUrl = `${APP_URL}/dashboard`

  const content = `
    <h1>Welcome to Fixpath</h1>
    <!--HEADER-->
    <p>Hi ${name},</p>
    <p>Your account is ready. You can now run professional-grade UX audits on any website in under 10 minutes.</p>
    <p>Your first audit is completely free -- no credit card needed.</p>

    <a href="${dashboardUrl}" class="btn">Go to your dashboard</a>

    <div class="info-box">
      <h2 style="margin-top:0">What you get with every audit</h2>
      <ul class="check-list">
        <li>112 checkpoints across 28 UX categories</li>
        <li>Severity-ranked findings with evidence</li>
        <li>Executive summary and top 3 recommendations</li>
        <li>Downloadable PDF and Word reports</li>
      </ul>
    </div>

    <p style="font-size:13px;color:#71717a">Have questions? Reply to this email or visit our <a href="${APP_URL}/faq" style="color:#111;font-weight:600">FAQ</a>.</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <hello@fixpath.ai>',
    email,
    'Welcome to Fixpath -- your first audit is free',
    emailLayout(content, `Welcome ${name}! Run your first UX audit for free.`),
  )
}

/* ═══════════════════════════════════════════════════════════════
   2. AUDIT COMPLETE — sent when AI analysis finishes
   ═══════════════════════════════════════════════════════════════ */

export async function sendAuditComplete(
  email: string,
  auditId: string,
  productUrl: string,
  auditType: 'website' | 'brand_identity' | 'design' = 'website',
): Promise<{ success: boolean; error?: string }> {
  const reportUrl = `${APP_URL}/dashboard/audits/${auditId}`

  const isBrand = auditType === 'brand_identity'
  const isDesign = auditType === 'design'

  let displayName = productUrl
  if (!isBrand && !isDesign) {
    try { displayName = new URL(productUrl).hostname.replace(/^www\./, '') } catch {}
  }

  const typeLabel = isBrand ? 'brand identity audit' : isDesign ? 'design audit' : 'UX audit'
  const typeTitle = isBrand ? 'Brand Identity Audit' : isDesign ? 'Design Audit' : 'UX Audit'
  const fieldLabel = isBrand ? 'Brand' : isDesign ? 'Design' : 'Website'
  const reportDescription = isBrand
    ? 'Your report includes an overall score, category breakdown across 7 brand dimensions, severity-ranked findings, and downloadable PDF/Word exports.'
    : 'Your report includes an overall score, pillar breakdown, severity-ranked findings, and downloadable PDF/Word exports. You can also share it with your team via a secure read-only link.'

  const content = `
    <h1>Your ${typeTitle.toLowerCase()} is ready</h1>
    <!--HEADER-->
    <p>Great news -- your comprehensive ${typeLabel} is complete and ready to review.</p>

    <div class="info-box">
      <table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#71717a">${fieldLabel}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${displayName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Status</td>
          <td style="padding:8px 0;text-align:right;border-top:1px solid #f0f0f0"><span class="pill pill-green">Complete</span></td>
        </tr>
      </table>
    </div>

    <a href="${reportUrl}" class="btn">View full report</a>

    <div class="divider"></div>
    <p style="font-size:13px;color:#71717a">${reportDescription}</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <audits@fixpath.ai>',
    email,
    `Your ${typeLabel} for ${displayName} is ready`,
    emailLayout(content, `Your ${typeLabel} for ${displayName} is complete. View your report now.`),
  )
}

/* ═══════════════════════════════════════════════════════════════
   3. PAYMENT / CREDITS PURCHASED — sent after Stripe checkout
   ═══════════════════════════════════════════════════════════════ */

export async function sendPaymentConfirmation(
  email: string,
  auditId: string,
  amount: number,
  productUrl: string,
  auditType: 'website' | 'brand_identity' | 'design' = 'website',
): Promise<{ success: boolean; error?: string }> {
  const amountUSD = (amount / 100).toFixed(2)

  const isBrand = auditType === 'brand_identity'
  const isDesign = auditType === 'design'

  let displayName = productUrl
  if (!isBrand && !isDesign) {
    try { displayName = new URL(productUrl).hostname.replace(/^www\./, '') } catch {}
  }

  const typeLabel = isBrand ? 'brand identity audit' : isDesign ? 'design audit' : 'UX audit'
  const fieldLabel = isBrand ? 'Brand' : isDesign ? 'Design' : 'Website'

  const content = `
    <h1>Payment received</h1>
    <!--HEADER-->
    <p>Thank you for your payment. Your ${typeLabel} for <strong>${displayName}</strong> has been queued and will begin processing shortly.</p>

    <div class="info-box">
      <table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#71717a">Amount</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">$${amountUSD}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">${fieldLabel}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${displayName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Status</td>
          <td style="padding:8px 0;text-align:right;border-top:1px solid #f0f0f0"><span class="pill pill-lime">Processing</span></td>
        </tr>
      </table>
    </div>

    <p>You will receive another email once your audit is complete (typically within 10 minutes). You can also check progress anytime in your <a href="${APP_URL}/dashboard" style="color:#111;font-weight:600">dashboard</a>.</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <billing@fixpath.ai>',
    email,
    `Payment received -- your ${typeLabel} is starting`,
    emailLayout(content, `Payment of $${amountUSD} received. Your ${typeLabel} for ${displayName} is processing.`),
  )
}

export async function sendCreditsPurchased(
  email: string,
  creditsAdded: number,
  newBalance: number,
  packName: string,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  const amountUSD = (amount / 100).toFixed(2)

  const content = `
    <h1>Credits added to your account</h1>
    <!--HEADER-->
    <p>Your credit pack purchase was successful. The credits are available immediately.</p>

    <div class="info-box">
      <table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#71717a">Pack</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${packName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Credits added</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">+${creditsAdded}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">New balance</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${newBalance} credits</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Amount</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">$${amountUSD}</td>
        </tr>
      </table>
    </div>

    <a href="${APP_URL}/dashboard" class="btn">Start an audit</a>

    <p style="font-size:13px;color:#71717a">Each credit covers one full UX audit. Credits never expire.</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <billing@fixpath.ai>',
    email,
    `${creditsAdded} audit credits added to your account`,
    emailLayout(content, `${creditsAdded} credits added. Your new balance is ${newBalance}.`),
  )
}

/* ═══════════════════════════════════════════════════════════════
   4. ACCOUNT DELETED — sent as final confirmation
   ═══════════════════════════════════════════════════════════════ */

export async function sendAccountDeleted(
  email: string,
  fullName?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const name = fullName || 'there'

  const content = `
    <h1>Account deleted</h1>
    <!--HEADER-->
    <p>Hi ${name},</p>
    <p>Your Fixpath account and all associated data have been permanently deleted. This includes all audit reports, findings, and personal information.</p>

    <div class="info-box">
      <table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#71717a">Account</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Status</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#ef4444">Permanently deleted</td>
        </tr>
      </table>
    </div>

    <p>If this was a mistake or you did not request this deletion, please contact us immediately at <a href="mailto:support@fixpath.ai" style="color:#111;font-weight:600">support@fixpath.ai</a>.</p>

    <p style="font-size:13px;color:#71717a">We are sorry to see you go. If you ever want to come back, you are always welcome to create a new account at <a href="${APP_URL}" style="color:#111;font-weight:600">fixpath.ai</a>.</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <hello@fixpath.ai>',
    email,
    'Your Fixpath account has been deleted',
    emailLayout(content, 'Your Fixpath account and all data have been permanently deleted.'),
  )
}

/* ═══════════════════════════════════════════════════════════════
   5. FREE AUDIT READY — specific variant for first free audit
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   5a. AUDIT TIMED OUT — sent when the stall sweeper kills a stuck audit
   ═══════════════════════════════════════════════════════════════ */

export async function sendAuditTimedOut(
  email: string,
  auditId: string,
  productUrl: string,
  ageMinutes: number,
  wasRefunded: boolean,
  auditType: 'website' | 'brand_identity' | 'design' = 'website',
): Promise<{ success: boolean; error?: string }> {
  const dashboardUrl = `${APP_URL}/dashboard`

  const isBrand = auditType === 'brand_identity'
  const isDesign = auditType === 'design'

  let displayName = productUrl || 'your site'
  if (!isBrand && !isDesign && productUrl) {
    try { displayName = new URL(productUrl).hostname.replace(/^www\./, '') } catch {}
  }

  const typeLabel = isBrand ? 'brand identity audit' : isDesign ? 'design audit' : 'UX audit'
  const fieldLabel = isBrand ? 'Brand' : isDesign ? 'Design' : 'Website'

  const refundLine = wasRefunded
    ? '<tr><td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Credit</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#22c55e;border-top:1px solid #f0f0f0">Refunded</td></tr>'
    : ''

  const content = `
    <h1>Audit timed out</h1>
    <!--HEADER-->
    <p>We are sorry -- your ${typeLabel} for <strong>${displayName}</strong> did not complete within our ${ageMinutes}-minute time limit and was automatically stopped.</p>

    <div class="info-box">
      <table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#71717a">${fieldLabel}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${displayName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Status</td>
          <td style="padding:8px 0;text-align:right;border-top:1px solid #f0f0f0"><span class="pill" style="background:rgba(239,68,68,0.1);color:#dc2626">Timed out</span></td>
        </tr>
        ${refundLine}
      </table>
    </div>

    ${wasRefunded ? '<p><strong>Your audit credit has been fully refunded</strong> and is available in your account right now. Nothing was charged.</p>' : ''}

    <p>This can happen when a website takes unusually long to crawl or has complex protections. Please try again -- most audits complete in under 10 minutes.</p>

    <a href="${dashboardUrl}" class="btn">Go to dashboard and try again</a>

    <div class="divider"></div>
    <p style="font-size:13px;color:#71717a">If this keeps happening, please <a href="${APP_URL}/contact" style="color:#111;font-weight:600">contact us</a> and we will look into it. We want every audit to succeed.</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <audits@fixpath.ai>',
    email,
    `Your ${typeLabel} for ${displayName} timed out -- credit refunded`,
    emailLayout(content, `Your ${typeLabel} for ${displayName} timed out. Your credit has been refunded.`),
  )
}

/* ═══════════════════════════════════════════════════════════════
   6. MONITORING REGRESSION ALERT — sent when a scheduled re-audit
      finds something that got worse (Phase 2 #2).
   ═══════════════════════════════════════════════════════════════ */

export async function sendRegressionAlertEmail(
  email: string,
  productUrl: string,
  alerts: Array<{ level: string; title: string; body: string }>,
): Promise<{ success: boolean; error?: string }> {
  if (!email || alerts.length === 0) return { success: false, error: 'no recipient or alerts' }

  let displayName = productUrl || 'your site'
  try { displayName = new URL(productUrl).hostname.replace(/^www\./, '') } catch {}

  const hasCritical = alerts.some((a) => a.level === 'critical')
  const dashboardUrl = `${APP_URL}/dashboard`

  const items = alerts.map((a) => `
    <div class="info-box" style="border-left:3px solid ${a.level === 'critical' ? '#dc2626' : '#d97706'};margin:12px 0">
      <h2 style="margin:0 0 6px;font-size:15px">${a.title}</h2>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46">${a.body}</p>
    </div>`).join('')

  const content = `
    <h1>${hasCritical ? 'Monitoring alert' : 'Heads up'}: ${displayName}</h1>
    <!--HEADER-->
    <p>Your automatic re-audit of <strong>${displayName}</strong> flagged ${alerts.length} change${alerts.length > 1 ? 's' : ''} since the previous run:</p>
    ${items}
    <a href="${dashboardUrl}" class="btn">Review in your dashboard</a>
    <div class="divider"></div>
    <p style="font-size:13px;color:#71717a">You're receiving this because automatic monitoring is on for this brand. Manage cadence in Track.</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <audits@fixpath.ai>',
    email,
    `${displayName}: ${alerts.length} monitoring alert${alerts.length > 1 ? 's' : ''}${hasCritical ? ' (action needed)' : ''}`,
    emailLayout(content, `${displayName}: ${alerts[0]?.title}`),
  )
}

export async function sendFreeAuditReady(
  email: string,
  auditId: string,
  productUrl: string,
  auditType: 'website' | 'brand_identity' | 'design' = 'website',
): Promise<{ success: boolean; error?: string }> {
  const reportUrl = `${APP_URL}/dashboard/audits/${auditId}`

  const isBrand = auditType === 'brand_identity'
  const isDesign = auditType === 'design'

  let displayName = productUrl
  if (!isBrand && !isDesign) {
    try { displayName = new URL(productUrl).hostname.replace(/^www\./, '') } catch {}
  }

  const typeLabel = isBrand ? 'brand identity audit' : isDesign ? 'design audit' : 'UX audit'
  const fieldLabel = isBrand ? 'Brand' : isDesign ? 'Design' : 'Website'

  const content = `
    <h1>Your free ${typeLabel} is ready</h1>
    <!--HEADER-->
    <p>Your complimentary ${typeLabel} for <strong>${displayName}</strong> is complete and ready to review.</p>

    <div class="info-box">
      <table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#71717a">${fieldLabel}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${displayName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Price</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#22c55e">Free</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a;border-top:1px solid #f0f0f0">Status</td>
          <td style="padding:8px 0;text-align:right;border-top:1px solid #f0f0f0"><span class="pill pill-green">Complete</span></td>
        </tr>
      </table>
    </div>

    <a href="${reportUrl}" class="btn">View your free report</a>

    <div class="divider"></div>
    <p style="font-size:13px;color:#71717a">Want more audits? Purchase credits from your dashboard to audit additional websites or re-audit the same site to track improvements over time.</p>
    <!--FOOTER-->
  `

  return send(
    'Fixpath <audits@fixpath.ai>',
    email,
    `Your free ${typeLabel} for ${displayName} is ready`,
    emailLayout(content, `Your free ${typeLabel} for ${displayName} is complete. View your report now.`),
  )
}
