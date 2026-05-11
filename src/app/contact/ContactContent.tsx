'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { ArrowRightIcon } from '@/components/marketing/icons'

export default function ContactContent() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send message.')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputBase = 'w-full bg-paper-2 border border-rule text-ink placeholder:text-m-muted focus:border-ink focus:outline-none font-sans text-[15px] transition-colors'

  return (
    <main>
      {/* Hero + Form */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="Contact" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-4" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            Get in <em className="italic text-signal">touch.</em>
          </h1>
          <p className="text-[18px] leading-[1.55] text-ink-2 max-w-[500px] mb-14 font-sans">
            Have a question, feedback, or need help with your audit? We&apos;ll get back to you within 24 hours.
          </p>

          <div className="grid lg:grid-cols-[2fr_1fr] gap-12 items-start">
            {/* Form */}
            <div>
              {submitted ? (
                <div className="border border-ink p-10">
                  <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-4 block">Sent</span>
                  <h3 className="font-serif text-[28px] text-ink font-normal mb-3">Message sent!</h3>
                  <p className="font-sans text-[15px] text-ink-2 mb-8">
                    Thanks for reaching out. We&apos;ll reply within 24 hours.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setSubmitted(false)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-rule text-[14px] font-medium font-sans text-ink hover:border-ink transition-colors"
                    >
                      Send another message
                    </button>
                    <a
                      href="/register"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-paper text-[14px] font-medium font-sans hover:bg-signal transition-colors"
                    >
                      Start free audit
                      <ArrowRightIcon size={12} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-ink p-10 max-sm:p-6">
                  <form onSubmit={handleSubmit} className="space-y-6" aria-label="Contact form">
                    {error && (
                      <div className="rounded-lg p-4 text-[14px] font-sans text-severe border border-severe/30 bg-severe/5">
                        {error}
                      </div>
                    )}

                    <div>
                      <label htmlFor="name" className="block text-[13px] font-medium font-sans text-ink mb-2">
                        Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        aria-required="true"
                        required
                        className={`${inputBase} rounded-full px-5 py-3`}
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-[13px] font-medium font-sans text-ink mb-2">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        aria-required="true"
                        required
                        className={`${inputBase} rounded-full px-5 py-3`}
                        placeholder="you@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-[13px] font-medium font-sans text-ink mb-2">
                        Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={5}
                        aria-required="true"
                        required
                        className={`${inputBase} rounded-xl px-5 py-3 resize-y`}
                        placeholder="How can we help?"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-ink text-paper text-[15px] font-medium font-sans hover:bg-signal transition-all disabled:opacity-60"
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
                          Send message
                          <ArrowRightIcon size={14} />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Contact info */}
            <div className="flex flex-col gap-0 border border-ink">
              <div className="p-7 border-b border-ink">
                <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-3 block">Email</span>
                <a
                  href="mailto:support@clearux.ai"
                  className="font-sans text-[15px] text-ink hover:text-signal transition-colors"
                >
                  support@clearux.ai
                </a>
              </div>
              <div className="p-7">
                <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-3 block">Response time</span>
                <p className="font-sans text-[15px] text-ink-2">Usually within 24 hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden" style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '100px 0' }}>
        <div className="absolute pointer-events-none" style={{ top: -100, right: -100, width: 400, height: 400, background: 'radial-gradient(circle, var(--signal) 0%, transparent 65%)', opacity: 0.18 }} />
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 relative text-center">
          <h2 className="font-serif font-normal leading-[0.95] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(40px, 5.5vw, 72px)', color: 'var(--paper)' }}>
            Start your audit <em className="italic text-signal">today</em>
          </h2>
          <p className="text-[18px] leading-[1.55] mb-10 font-sans max-w-[480px] mx-auto" style={{ color: 'color-mix(in srgb, var(--paper) 75%, transparent)' }}>
            Your first audit is free. No credit card, no commitment.
          </p>
          <a
            href="/register"
            className="coda-cta inline-flex items-center gap-2 font-sans font-medium text-[15px] rounded-full px-8 py-4 transition-all"
          >
            Start free audit
            <ArrowRightIcon size={14} />
          </a>
        </div>
      </section>
    </main>
  )
}
