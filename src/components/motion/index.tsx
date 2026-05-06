'use client'

import React, { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  type Variants,
} from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   Reusable Framer Motion components for ClearUX homepage
   ═══════════════════════════════════════════════════════════════ */

/* ── Fade-up on scroll (replaces old useScrollReveal) ──────── */
export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  duration = 0.6,
  y = 40,
  once = true,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  y?: number
  once?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Stagger children on scroll ────────────────────────────── */
const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export function StaggerReveal({
  children,
  className = '',
  staggerDelay = 0.12,
}: {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}) {
  const custom: Variants = {
    ...staggerContainer,
    visible: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  }

  return (
    <motion.div
      variants={custom}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  )
}

/* ── Scale-in reveal ───────────────────────────────────────── */
export function ScaleReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Slide-in from left or right ───────────────────────────── */
export function SlideReveal({
  children,
  className = '',
  direction = 'left',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  direction?: 'left' | 'right'
  delay?: number
}) {
  const x = direction === 'left' ? -60 : 60
  return (
    <motion.div
      initial={{ opacity: 0, x }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Parallax floating element ─────────────────────────────── */
export function ParallaxFloat({
  children,
  className = '',
  speed = 0.3,
  direction = 'up',
}: {
  children: React.ReactNode
  className?: string
  speed?: number
  direction?: 'up' | 'down'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const multiplier = direction === 'up' ? -1 : 1
  const y = useTransform(scrollYProgress, [0, 1], [multiplier * speed * 100, multiplier * speed * -100])

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}

/* ── Animated progress bar (fills when in view) ────────────── */
export function AnimatedBar({
  value,
  className = '',
  barClass = 'bg-text',
  delay = 0,
}: {
  value: number
  className?: string
  barClass?: string
  delay?: number
}) {
  return (
    <div className={`h-2 rounded-full bg-border/30 dark:bg-white/[0.06] overflow-hidden ${className}`}>
      <motion.div
        className={`h-full rounded-full ${barClass}`}
        initial={{ width: 0 }}
        whileInView={{ width: `${value}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  )
}

/* ── Animated counter with spring physics ──────────────────── */
export function AnimatedCounter({
  end,
  suffix = '',
  prefix = '',
  className = '',
  duration = 1.5,
}: {
  end: number
  suffix?: string
  prefix?: string
  className?: string
  duration?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-20px' })

  // Use requestAnimationFrame for smooth counting
  const started = useRef(false)
  const [displayCount, setDisplayCount] = React.useState(0)

  React.useEffect(() => {
    if (!isInView || started.current) return
    started.current = true
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayCount(Math.round(eased * end))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [isInView, end, duration])

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {prefix}{displayCount}{suffix}
    </motion.div>
  )
}

/* (React imported at top of file) */

/* ── Section transition — gradient overlap ─────────────────── */
export function SectionTransition({
  from = 'transparent',
  to = 'transparent',
  height = 120,
}: {
  from?: string
  to?: string
  height?: number
}) {
  return (
    <div
      className="pointer-events-none"
      style={{
        height,
        background: `linear-gradient(to bottom, ${from}, ${to})`,
        marginTop: -height / 2,
        marginBottom: -height / 2,
        position: 'relative',
        zIndex: 2,
      }}
    />
  )
}

/* ── Floating decorative orb ───────────────────────────────── */
export function FloatingOrb({
  className = '',
  size = 300,
  color = 'rgba(16,185,129,0.06)',
  delay = 0,
}: {
  className?: string
  size?: number
  color?: string
  delay?: number
}) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }}
      animate={{
        y: [0, -20, 0, 15, 0],
        x: [0, 10, -10, 5, 0],
        scale: [1, 1.05, 0.95, 1.02, 1],
      }}
      transition={{
        duration: 12,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}
