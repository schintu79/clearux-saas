import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function NotFound() {
  return (
    <div className="bg-surface text-text min-h-screen flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md mx-auto">
          <p className="text-6xl font-heading font-semibold text-text mb-4">
            404
          </p>
          <h1 className="text-2xl font-semibold font-heading text-text mb-3">
            Page not found
          </h1>
          <p className="text-muted text-base leading-relaxed mb-8">
            No worries — this page may have moved or the link might be outdated.
            Let&apos;s get you back on track.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-[15px] font-semibold bg-brand text-surface dark:text-[#111111] rounded-xl transition-all hover:brightness-110 min-h-[48px]"
            >
              Go to homepage
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-text bg-card border border-border rounded-lg hover:bg-surface-alt transition-colors min-h-[44px]"
            >
              Contact support
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
