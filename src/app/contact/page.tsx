'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Mail, MessageSquare, Send, CheckCircle } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">
        {/* Hero area with subtle kaleidoscope glow */}
        <section className="relative overflow-hidden">
          <div className="absolute top-[-10%] left-[20%] w-[400px] h-[350px] rounded-full bg-brand/[0.04] blur-[120px] pointer-events-none" />
          <div className="absolute top-[20%] right-[15%] w-[300px] h-[300px] rounded-full bg-pink-500/[0.03] blur-[100px] pointer-events-none" />

          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16 relative">
            <p className="text-sm font-semibold tracking-wide uppercase mb-4 text-brand">Get in touch</p>
            <h1 className="font-heading font-semibold text-3xl sm:text-4xl text-text mb-3">
              Contact Us
            </h1>
            <p className="text-text/70 mb-10 max-w-lg">
              Have a question, feedback, or need help with your audit? Drop us a message and we&rsquo;ll
              get back to you as soon as possible.
            </p>

            {submitted ? (
              <div className="rounded-xl p-8 text-center border border-[#22C55E]/20 dark:border-[#22C55E]/20 bg-[#22C55E]/5 dark:bg-[#22C55E]/10">
                <div className="w-14 h-14 rounded-xl bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-[#22C55E]" />
                </div>
                <p className="font-heading font-semibold text-lg text-text mb-1">Message sent!</p>
                <p className="text-text/70 text-sm">Thanks for reaching out. We&rsquo;ll reply within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" aria-label="Contact form">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-text mb-1.5">Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    aria-required="true"
                    required
                    className="input"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-text mb-1.5">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    aria-required="true"
                    required
                    className="input"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-text mb-1.5">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    aria-required="true"
                    required
                    className="input resize-y"
                    placeholder="How can we help?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] text-[15px] rounded-xl bg-brand text-surface dark:text-[#111111] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
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
            )}

            <div className="mt-12 pt-8 border-t border-border">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                    <Mail size={18} className="text-[#6366F1]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text mb-0.5">Email us</p>
                    <a href="mailto:support@clearux.ai" className="text-sm text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">support@clearux.ai</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={18} className="text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text mb-0.5">Response time</p>
                    <p className="text-sm text-muted">Usually within 24 hours</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
