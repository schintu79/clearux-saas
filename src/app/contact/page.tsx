'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { Mail, MessageSquare, Send, CheckCircle, ArrowRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function ContactPage() {
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

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh]">
        {/* Hero */}
        <section className="py-24 sm:py-32 bg-[#111114]">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40">
              GET IN TOUCH
            </span>
            <h1 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light tracking-tight text-white mt-6">
              Contact <em className="italic text-white/40">us.</em>
            </h1>
            <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-xl mt-6">
              Have a question, feedback, or need help with your audit? We&rsquo;ll get back to you within 24 hours.
            </p>
          </div>
        </section>

        {/* Form Section */}
        <section className="py-24 sm:py-32 bg-[#111114]">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
            <div className="max-w-xl">
              {submitted ? (
                <div className="rounded-xl p-9 border border-white/[0.06] bg-white/[0.03]">
                  <div className="w-14 h-14 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
                    <CheckCircle size={28} className="text-white/60" />
                  </div>
                  <p className="font-heading font-semibold text-lg text-white mb-1">Message sent!</p>
                  <p className="font-body text-sm text-white/50">Thanks for reaching out. We&rsquo;ll reply within 24 hours.</p>
                </div>
              ) : (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 sm:p-10">
                  <form onSubmit={handleSubmit} className="space-y-6" aria-label="Contact form">
                    {error && (
                      <div className="rounded-lg p-4 text-sm font-body text-red-400 border border-red-800 bg-red-900/20">
                        {error}
                      </div>
                    )}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium font-body text-white mb-1.5">Name</label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        aria-required="true"
                        required
                        className="rounded-lg bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none px-4 py-3 text-sm font-body w-full"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium font-body text-white mb-1.5">Email</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        aria-required="true"
                        required
                        className="rounded-lg bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none px-4 py-3 text-sm font-body w-full"
                        placeholder="you@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium font-body text-white mb-1.5">Message</label>
                      <textarea
                        id="message"
                        name="message"
                        rows={5}
                        aria-required="true"
                        required
                        className="rounded-lg bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none px-4 py-3 text-sm font-body w-full resize-y"
                        placeholder="How can we help?"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 whitespace-nowrap disabled:opacity-60"
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
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Contact Info */}
              <div className="mt-14 pt-10 border-t border-white/[0.06]">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Mail size={18} className="text-white/50" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold font-body text-white mb-0.5">Email us</p>
                      <a href="mailto:support@clearux.ai" className="text-sm font-body text-white/50 hover:text-white/70 transition-colors">support@clearux.ai</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={18} className="text-white/50" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold font-body text-white mb-0.5">Response time</p>
                      <p className="text-sm font-body text-white/50">Usually within 24 hours</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 sm:py-32 bg-[#141418]">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40">
              GET STARTED
            </span>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-light tracking-tight text-white mt-6">
              Ready to see what you&rsquo;re <em className="italic text-white/40">missing?</em>
            </h2>
            <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-xl mt-6 mb-10">
              Your first audit is free. Results in under 10 minutes.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 whitespace-nowrap"
            >
              Start Free Audit
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
