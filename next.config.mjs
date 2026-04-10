/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit requires native Node.js modules and font file access.
  // Mark it as external so webpack doesn't try to bundle it.
  serverExternalPackages: ['pdfkit'],

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
