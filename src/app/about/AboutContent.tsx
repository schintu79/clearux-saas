'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight,
  Eye,
  Shield,
  Heart,
  Sparkles,
  User,
  ExternalLink,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   AboutContent — Why ClearUX exists, founder, values
   ══════════════════════════════════════���════════════════════════ */

export default function AboutContent() {
  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          1. HERO
          ═══════════════════════════════════════════════���═══════ */}
      <section className="relative overflow-hidden py-28 sm:py-36 px-4 md:px-6 lg:px-8" style={{ background: '#080808' }}>
        <div className="absolute top-[-10%] left-[15%] w-[600px] h-[500px] rounded-full bg-[#B9FF66]/[0.05] blur-[160px] pointer-events-none" />
        <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#6366F1]/[0.04] blur-[140px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <div className="w-2 h-2 rounded-full animate-pulse bg-[#B9FF66]" />
              <span className="text-sm font-semibold tracking-wide text-white/60">About ClearUX</span>
            </div>
          </motion.div>

          <motion.h1
            className="font-heading font-semibold text-4xl sm:text-5xl md:text-6xl text-white mb-6"
            style={{ lineHeight: '1.1' }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Every product deserves an independent, unbiased review.
          </motion.h1>

          <motion.p
            className="text-white/50 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
          >
            ClearUX exists because great user experience shouldn&apos;t be a luxury reserved for companies with six-figure consultancy budgets.
          </motion.p>
        </div>
      </section>

      {/* ══════════════════════��════════════════════════════════
          2. WHY WE EXIST — Origin story
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
        <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[#B9FF66]/[0.03] blur-[160px] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">The origin story</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text tracking-tight">
              Why ClearUX exists
            </h2>
          </motion.div>

          {/* Quote */}
          <motion.div
            className="mb-14 p-6 sm:p-8 rounded-2xl bg-card border border-border/30"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-text font-medium text-lg sm:text-xl leading-relaxed italic text-center max-w-2xl mx-auto">
              &ldquo;What if the depth of a senior consultant&apos;s review could be available to anyone, in minutes, at a fraction of the cost?&rdquo;
            </p>
          </motion.div>

          {/* Three story blocks */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Eye,
                color: '#6366F1',
                title: 'The problem we saw',
                desc: 'After 20+ years in digital, the pattern was clear: companies that needed UX audits the most couldn\'t afford them. Enterprise got $15K consultants. Everyone else was left guessing.',
              },
              {
                icon: Shield,
                color: '#EC4899',
                title: 'What kept going wrong',
                desc: 'Dark patterns eroding trust. Inaccessible interfaces excluding real users. Products that ignore emotional design failing to connect. These cost businesses revenue and cost users their dignity.',
              },
              {
                icon: Sparkles,
                color: '#B9FF66',
                title: 'What we built instead',
                desc: 'Not a checklist tool. A human-centered audit framework — 16 categories, 4 pillars — that examines products the way a skilled UX researcher would: with empathy, evidence, and actionable clarity.',
              },
            ].map((item, idx) => {
              const ItemIcon = item.icon
              return (
                <motion.div
                  key={item.title}
                  className="rounded-2xl bg-card border border-border/30 p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${item.color}15` }}
                  >
                    <ItemIcon size={20} style={{ color: item.color }} />
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-text mb-3">{item.title}</h3>
                  <p className="text-muted text-[14px] leading-relaxed">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═════════��═════════════════════════════════════════════
          3. FOUNDER
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 md:px-6 lg:px-8 bg-off overflow-hidden">
        <div className="max-w-4xl mx-auto relative">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">The founder</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text tracking-tight">
              Built by someone who lived the problem
            </h2>
          </motion.div>

          <motion.div
            className="rounded-2xl bg-card border border-border/30 p-8 sm:p-10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
              {/* Avatar placeholder */}
              <div className="w-20 h-20 rounded-2xl bg-[#B9FF66]/10 border border-[#B9FF66]/20 flex items-center justify-center flex-shrink-0">
                <User size={32} className="text-[#B9FF66]" />
              </div>

              <div className="flex-1">
                <h3 className="font-heading font-semibold text-xl text-text mb-1">Stefano Schintu</h3>
                <p className="text-muted text-sm mb-4">Founder &amp; Product Lead</p>

                <div className="space-y-4 text-muted text-[15px] leading-relaxed">
                  <p>
                    20+ years in digital product design, UX strategy, and conversion optimisation. Worked with startups, agencies, and enterprise teams across Europe and the UK ��� from early-stage MVPs to products serving millions.
                  </p>
                  <p>
                    The frustration was always the same: brilliant teams shipping products without an unbiased, structured UX review — because the only option was a consultant charging five figures and taking six weeks. The teams that needed it most could never afford it.
                  </p>
                  <p>
                    ClearUX was built to close that gap. Same depth, same rigour, accessible to everyone — in minutes instead of weeks, at a fraction of the cost.
                  </p>
                </div>

                <a
                  href="https://www.linkedin.com/in/stefanoschintu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-text hover:opacity-70 transition-opacity"
                >
                  <ExternalLink size={14} />
                  Connect on LinkedIn
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════���════════════════════
          4. OUR VALUES — Simple, clear, reliable
          ═══════���═══════════════════��═══════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
        <div className="absolute bottom-[15%] left-[10%] w-[400px] h-[400px] rounded-full bg-[#6366F1]/[0.03] blur-[140px] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">Our commitment</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text tracking-tight">
              Clear, simple, and reliable
            </h2>
            <p className="text-muted text-base sm:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
              We hold ourselves to the same standard we measure others by.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                color: '#6366F1',
                title: 'Ethical by default',
                desc: 'Every audit checks for dark patterns, manipulative design, and cognitive overload. We refuse to use them ourselves — no subscription traps, no pressure tactics, no hidden costs.',
              },
              {
                icon: Eye,
                color: '#22C55E',
                title: 'Evidence over opinion',
                desc: 'Scores are backed by 64 measurable checkpoints across 16 categories. No subjective hand-waving. Every finding links to evidence you can verify.',
              },
              {
                icon: Heart,
                color: '#EC4899',
                title: 'Accessible to all',
                desc: 'A $99 audit delivers what used to cost $5K-15K from a consultant. Quality UX review shouldn\'t be a luxury reserved for well-funded teams.',
              },
            ].map((item, idx) => {
              const ItemIcon = item.icon
              return (
                <motion.div
                  key={item.title}
                  className="rounded-2xl bg-card border border-border/30 p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${item.color}15` }}
                  >
                    <ItemIcon size={20} style={{ color: item.color }} />
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-text mb-3">{item.title}</h3>
                  <p className="text-muted text-[14px] leading-relaxed">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══���═══════════════════════════════════════════════════
          5. LIME CTA BAND
          ═════════��══════════════════���══════════════════════════ */}
      <section className="relative py-28 sm:py-36 px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: '#B9FF66' }}>
        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-[#111]/50">
              Start your audit today
            </p>
            <h2
              className="font-heading font-semibold text-4xl sm:text-5xl text-[#111] mb-6"
              style={{ lineHeight: '1.1' }}
            >
              Ready to see what<br className="hidden sm:block" /> you&apos;re missing?
            </h2>
            <p className="text-[#111]/60 text-lg mb-10 max-w-lg mx-auto">
              64 checkpoints. 16 categories. Results in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-[#111] text-[#B9FF66] text-[15px] rounded-xl font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-all"
              >
                Run my free audit
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] text-sm border-2 border-[#111]/20 text-[#111] rounded-xl font-semibold hover:bg-white/30 transition-all"
              >
                See how it works
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
