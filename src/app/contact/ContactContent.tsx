'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Mail, MessageSquare, Send, CheckCircle, ArrowRight } from 'lucide-react';
import SmartCta from '@/components/ui/SmartCta';

export default function ContactContent() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="flex-1">
      {/* ── Single page background ── */}
      <div className="fixed inset-0" aria-hidden="true">
        <img src="/gradients/bg-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-80 hidden dark:block" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface via-transparent to-surface" />
      </div>

      {/* ── HERO + FORM ── */}
      <section className="relative py-28 sm:py-36 lg:py-44 overflow-hidden">

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            GET IN TOUCH
          </p>

          <h1
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text max-w-3xl"
            style={{ lineHeight: '1.1' }}
          >
            Contact <span className="text-lime-gradient">us.</span>
          </h1>

          <p className="text-muted text-base sm:text-lg max-w-xl leading-relaxed mt-3 mb-14">
            Have a question, feedback, or need help with your audit? We&rsquo;ll get back to you within 24 hours.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* ── Form card ── */}
            <div className="lg:col-span-2">
              {submitted ? (
                <div className="rounded-2xl border border-border bg-card backdrop-blur-sm p-8 sm:p-10">
                  <div className="w-14 h-14 rounded-xl bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 flex items-center justify-center mb-5">
                    <CheckCircle size={28} className="text-[#6B9A2E] dark:text-[#BFFA60]" />
                  </div>
                  <p className="font-heading font-medium text-lg text-text mb-1">Message sent!</p>
                  <p className="font-body text-sm text-muted mb-6">
                    Thanks for reaching out. We&rsquo;ll reply within 24 hours.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setSubmitted(false)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium text-text hover:bg-card-hover transition-colors"
                    >
                      Send another message
                    </button>
                    <SmartCta
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F0F0F] text-white dark:bg-white dark:text-[#111114] text-sm font-medium hover:opacity-90 transition-all"
                      iconSize={14}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card backdrop-blur-sm p-6 sm:p-8 md:p-10">
                  <form onSubmit={handleSubmit} className="space-y-6" aria-label="Contact form">
                    {error && (
                      <div className="rounded-lg p-4 text-sm font-body text-red-400 border border-red-800 bg-red-900/20">
                        {error}
                      </div>
                    )}

                    <div>
                      <label htmlFor="name" className="block text-sm font-medium font-body text-text mb-1.5">
                        Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        aria-required="true"
                        required
                        className="rounded-full bg-card-hover border border-border text-text placeholder:text-muted focus:border-border focus:outline-none px-5 py-3 text-base font-body w-full"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium font-body text-text mb-1.5">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        aria-required="true"
                        required
                        className="rounded-full bg-card-hover border border-border text-text placeholder:text-muted focus:border-border focus:outline-none px-5 py-3 text-base font-body w-full"
                        placeholder="you@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium font-body text-text mb-1.5">
                        Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={5}
                        aria-required="true"
                        required
                        className="rounded-2xl bg-card-hover border border-border text-text placeholder:text-muted focus:border-border focus:outline-none px-5 py-3 text-base font-body w-full resize-y"
                        placeholder="How can we help?"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px] disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Send message
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* ── Contact info cards ── */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-card backdrop-blur-sm p-6">
                <div className="w-10 h-10 rounded-xl bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 flex items-center justify-center mb-4">
                  <Mail size={18} className="text-[#6B9A2E] dark:text-[#BFFA60]" />
                </div>
                <p className="text-sm font-medium font-body text-text mb-1">Email us</p>
                <a
                  href="mailto:support@clearux.ai"
                  className="text-sm font-body text-muted hover:text-muted transition-colors"
                >
                  support@clearux.ai
                </a>
              </div>

              <div className="rounded-2xl border border-border bg-card backdrop-blur-sm p-6">
                <div className="w-10 h-10 rounded-xl bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 flex items-center justify-center mb-4">
                  <MessageSquare size={18} className="text-[#6B9A2E] dark:text-[#BFFA60]" />
                </div>
                <p className="text-sm font-medium font-body text-text mb-1">Response time</p>
                <p className="text-sm font-body text-muted">Usually within 24 hours</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── STANDARD FINAL CTA ── */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text mb-4"
            style={{ lineHeight: '1.1' }}
          >
            Start your audit <span className="text-lime-gradient">today</span>
          </h2>
          <p className="text-muted text-base sm:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment — actionable UX insights in minutes.
          </p>
          <SmartCta
            className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
          />
        </div>
      </section>

    </main>
  );
}
