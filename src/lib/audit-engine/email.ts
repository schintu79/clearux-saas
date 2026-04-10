// ============================================================
// ClearUX Audit Engine — Email Notifications via Resend
// ============================================================

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clearux.ai'

/**
 * Send audit completion email to user
 */
export async function sendAuditComplete(
  email: string,
  auditId: string,
  productUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const reportUrl = `${APP_URL}/dashboard/audits/${auditId}`

    const { data, error } = await resend.emails.send({
      from: 'ClearUX <audits@clearux.ai>',
      to: email,
      subject: 'Your UX Audit is Ready',
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
      .section { margin-bottom: 20px; }
      .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; }
      .footer { font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; }
      .product-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #667eea; }
      .check { color: #10b981; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Your UX Audit is Ready!</h1>
        <p>ClearUX has completed its analysis of your product.</p>
      </div>
      <div class="content">
        <div class="section">
          <p>Hi there,</p>
          <p>Great news! Your comprehensive UX audit for <strong>${productUrl}</strong> is now complete. Our AI-powered analysis has identified opportunities to improve user experience, conversion rates, and overall product quality.</p>
        </div>

        <div class="product-info">
          <strong>Audited URL:</strong><br>${productUrl}
        </div>

        <div class="section">
          <h2 style="color: #667eea; margin: 20px 0 10px 0;">What's Included</h2>
          <ul style="color: #666;">
            <li><span class="check">✓</span> Executive Summary</li>
            <li><span class="check">✓</span> Critical, High, Medium & Low Priority Issues</li>
            <li><span class="check">✓</span> Detailed Recommendations</li>
            <li><span class="check">✓</span> UX, Mobile, & Conversion Scores</li>
            <li><span class="check">✓</span> Evidence-Based Findings</li>
          </ul>
        </div>

        <div class="section">
          <p><strong>View your complete audit report:</strong></p>
          <a href="${reportUrl}" class="btn">Open Report</a>
        </div>

        <div class="section" style="background: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0;"><strong>💡 Tip:</strong> Share this report with your team to align on improvement priorities. The report includes actionable recommendations for each finding.</p>
        </div>

        <div class="footer">
          <p>Have questions? Contact us at support@clearux.ai</p>
          <p>© 2026 ClearUX. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>
      `,
    })

    if (error) {
      console.error('Resend email error:', error)
      return { success: false, error: error.message }
    }

    console.log(`Audit completion email sent to ${email}:`, data)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to send audit completion email:', message)
    return { success: false, error: message }
  }
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmation(
  email: string,
  auditId: string,
  amount: number,
  productUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const amountUSD = (amount / 100).toFixed(2)

    const { data, error } = await resend.emails.send({
      from: 'ClearUX <billing@clearux.ai>',
      to: email,
      subject: 'Payment Received - Your Audit is Starting',
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #10b981; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
      .receipt { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
      .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
      .receipt-row.total { font-weight: bold; border: none; }
      .footer { font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Payment Received ✓</h1>
        <p>Your audit is now being processed.</p>
      </div>
      <div class="content">
        <div class="section">
          <p>Thank you for your payment! Your UX audit for <strong>${productUrl}</strong> has been queued and will begin processing shortly.</p>
        </div>

        <div class="receipt">
          <h3 style="margin-top: 0;">Receipt</h3>
          <div class="receipt-row">
            <span>Audit ID:</span>
            <span>${auditId}</span>
          </div>
          <div class="receipt-row">
            <span>Amount Paid:</span>
            <span>$${amountUSD}</span>
          </div>
          <div class="receipt-row">
            <span>Audit URL:</span>
            <span>${productUrl}</span>
          </div>
          <div class="receipt-row total">
            <span>Status:</span>
            <span style="color: #10b981;">Processing</span>
          </div>
        </div>

        <div class="section">
          <p>You'll receive an email notification once your audit is complete (typically within 24-48 hours). You can check progress anytime in your dashboard.</p>
        </div>

        <div class="footer">
          <p>© 2026 ClearUX. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>
      `,
    })

    if (error) {
      console.error('Resend email error:', error)
      return { success: false, error: error.message }
    }

    console.log(`Payment confirmation email sent to ${email}:`, data)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to send payment confirmation email:', message)
    return { success: false, error: message }
  }
}
