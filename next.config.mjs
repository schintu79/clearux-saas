import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit requires native Node.js modules and font file access.
  // Mark it as external so webpack doesn't try to bundle it.
  serverExternalPackages: ['pdfkit', '@sparticuz/chromium', 'puppeteer-core', 'ssh2', 'basic-ftp'],

  // Increase serverless function timeout for Inngest steps
  // (crawling + AI analysis can take up to 5 minutes per step)
  // Requires Vercel Pro plan ($20/month)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default withSentryConfig(nextConfig, {
  // org/project only matter for source-map upload, which only runs when
  // SENTRY_AUTH_TOKEN is set (add it in Vercel env to get readable stack
  // traces). Builds succeed without it.
  org: process.env.SENTRY_ORG || 'fixpath',
  project: process.env.SENTRY_PROJECT || 'clearux-saas',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
