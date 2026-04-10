'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    // For now, simulate a submit. In production, wire this to an API route or email service.
    await new Promise((r) => setTimeout(r, 800))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-surface">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="font-manrope font-bold text-3xl sm:text-4xl text-text mb-3">
            Contact Us
          </h1>
          <p className="text-text/70 mb-10">
            Have a question, feedback, or need help with your audit? Drop us a message and we&rsquo;ll
            get back to you as soon as possible.
          </p>

          {submitted ? (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-6 text-center">
              <p className="text-accent font-semibold text-lg mb-1">Message sent!</p>
              <p className="text-text/70 text-sm">Thanks for reaching out. We&rsquo;ll reply within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text mb-1">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text mb-1">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-text mb-1">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
                  placeholder="How can we help?"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dk transition-colors disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}

          <div className="mt-12 pt-8 border-t border-border text-sm text-muted">
            <p>You can also reach us at <a href="mailto:support@clearux.net" className="text-accent hover:underline">support@clearux.net</a></p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
