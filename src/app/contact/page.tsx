'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
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
        {/* Dark Hero */}
        <section className="relative overflow-hidden py-28 sm:py-36 px-4 md:px-6 lg:px-8" style={{ background: '#080808' }}>
          <div className="absolute top-[-10%] left-[15%] w-[600px] h-[500px] rounded-full bg-[#10B981]/[0.05] blur-[160px] pointer-events-none" />
          <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#6366F1]/[0.04] blur-[140px] pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
                <div className="w-2 h-2 rounded-full animate-pulse bg-[#10B981]" />
                <span className="text-sm font-semibold tracking-wide text-white/60">Get in touch</span>
              </div>
            </motion.div>
            <motion.h1
              className="font-heading font-semibold text-4xl sm:text-5xl md:text-6xl text-white mb-6"
              style={{ lineHeight: '1.1' }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Contact Us
            </motion.h1>
            <motion.p
              className="text-white/50 text-lg max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              Have a question, feedback, or need help with your audit? We&rsquo;ll get back to you within 24 hours.
            </motion.p>
          </div>
        </section>

        {/* Form Section */}
        <section className="py-20 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface">
          <motion.div
            className="max-w-xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {submitted ? (
              <div className="rounded-2xl p-9 text-center border border-[#22C55E]/15 dark:border-[#22C55E]/15 bg-[#22C55E]/5 dark:bg-[#22C55E]/10 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
                <div className="w-14 h-14 rounded-xl bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-[#22C55E]" />
                </div>
                <p className="font-heading font-semibold text-lg text-text mb-1">Message sent!</p>
                <p className="text-text/70 text-sm">Thanks for reaching out. We&rsquo;ll reply within 24 hours.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border/30 p-8 sm:p-10">
                <form onSubmit={handleSubmit} className="space-y-6" aria-label="Contact form">
                  {error && (
                    <div className="rounded-xl p-4 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                      {error}
                    </div>
                  )}
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
              </div>
            )}
          </motion.div>

          {/* Contact Info */}
          <motion.div
            className="max-w-xl mx-auto mt-14 pt-10 border-t border-border/30 dark:border-white/[0.05]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex flex-col sm:flex-row gap-6">
              <motion.div
                className="flex items-start gap-3"
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                  <Mail size={18} className="text-[#6366F1]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text mb-0.5">Email us</p>
                  <a href="mailto:support@clearux.ai" className="text-sm text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">support@clearux.ai</a>
                </div>
              </motion.div>
              <motion.div
                className="flex items-start gap-3"
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.45 }}
              >
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={18} className="text-pink-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text mb-0.5">Response time</p>
                  <p className="text-sm text-muted">Usually within 24 hours</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Lime CTA Band */}
        <section className="w-full py-24 sm:py-32 px-4" style={{ background: '#10B981' }}>
          <motion.div
            className="text-center max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
              Ready to see what you&rsquo;re missing?
            </h3>
            <p className="text-white/70 text-sm sm:text-base mb-8">
              Your first audit is free. Results in under 10 minutes.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center gap-3 bg-[#111] text-[#34D399] text-base font-bold px-10 py-4 rounded-2xl transition-all hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)] hover:-translate-y-1"
            >
              Start Free Audit
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  )
}
