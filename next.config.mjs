import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit requires native Node.js modules and font file access.
  // Mark it as external so webpack doesn't try to bundle it.
  serverExternalPackages: ['pdfkit', '@sparticuz/chromium', 'puppeteer-core', 'ssh2', 'basic-ftp'],

  // D4 fix (Plan §0.6): Next's output file tracing only ships files it can
  // statically see. @sparticuz/chromium locates its ~80MB of brotli-packed
  // binaries via fs at runtime, so they were NEVER included in the deployed
  // function bundle — executablePath() threw, every in-process Chromium
  // launch failed for months ("No Chromium/Chrome binary found"), and the
  // bare catch blocks hid the reason. Ship the bin folder with every
  // function that launches a browser.
  outputFileTracingIncludes: {
    '/api/inngest': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/screenshot': ['./node_modules/@sparticuz/chromium/bin/**'],
  },

  // Increase serverless function timeout for Inngest steps
  // (crawling + AI analysis can take up to 5 minutes per step)
  // Requires Vercel Pro plan ($20/month)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // 2026-06-12: WCAG checker passes inline functions to page.evaluate();
    // the minifier renames their closure references, and the serialized
    // function dies in the browser with TDZ errors ("Cannot access 'ew'
    // before initialization" — first seen the moment Chromium actually
    // worked in prod). Server bundles don't need minification (size is
    // not user-facing). TEMPORARY until the evaluate blocks are made
    // self-contained — tracked in the plan's debt register.
    serverMinification: false,
  },
};

export default withSentryConfig(nextConfig, {
  // org/project only matter for source-map upload, which only runs when
  // SENTRY_AUTH_TOKEN is set (add it in Vercel env to get readable stack
  // traces). Builds succeed without it.
  org: process.env.SENTRY_ORG || 'fixpathai',
  project: process.env.SENTRY_PROJECT || 'clearux-saas',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
