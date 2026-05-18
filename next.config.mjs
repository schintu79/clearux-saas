/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit requires native Node.js modules and font file access.
  // Mark these as external so neither webpack nor Turbopack tries to bundle
  // their non-ECMAScript native bindings (e.g. ssh2/lib/protocol/crypto.js).
  serverExternalPackages: ['pdfkit', '@sparticuz/chromium', 'puppeteer-core', 'ssh2', 'basic-ftp', 'cpu-features'],

  // Increase serverless function timeout for Inngest steps
  // (crawling + AI analysis can take up to 5 minutes per step)
  // Requires Vercel Pro plan ($20/month)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
