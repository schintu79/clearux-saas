'use client'

import Image from 'next/image'

/* ══════════════════════════════════════════════════════════════
   Aurora Background — Real gradient blob PNGs layered with
   CSS blur, opacity, and animation for atmospheric depth.
   ══════════════════════════════════════════════════════════════ */

interface AuroraBackgroundProps {
  variant?: 'hero' | 'section' | 'cta' | 'subtle'
  className?: string
}

export default function AuroraBackground({ variant = 'section', className = '' }: AuroraBackgroundProps) {
  if (variant === 'hero') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
        {/* Foundation — purple orb, top-left */}
        <div
          className="absolute -top-[15%] left-[5%] w-[55%] h-[65%] rounded-full opacity-[0.45]"
          style={{
            background: 'radial-gradient(circle at center, #6B5B95 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'aurora-drift-1 20s ease-in-out infinite',
          }}
        />

        {/* Human Experience — pink orb, top-right */}
        <div
          className="absolute -top-[5%] right-[0%] w-[50%] h-[60%] rounded-full opacity-[0.4]"
          style={{
            background: 'radial-gradient(circle at center, #EC4899 0%, transparent 70%)',
            filter: 'blur(50px)',
            animation: 'aurora-drift-2 25s ease-in-out infinite',
          }}
        />

        {/* Inclusive Design — amber orb, bottom-center */}
        <div
          className="absolute top-[35%] left-[20%] w-[50%] h-[60%] rounded-full opacity-[0.4]"
          style={{
            background: 'radial-gradient(circle at center, #F59E0B 0%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'aurora-drift-3 18s ease-in-out infinite',
          }}
        />

        {/* Future Readiness — green orb, bottom-right */}
        <div
          className="absolute top-[30%] right-[5%] w-[45%] h-[55%] rounded-full opacity-[0.45]"
          style={{
            background: 'radial-gradient(circle at center, #22C55E 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'aurora-drift-1 22s ease-in-out infinite reverse',
          }}
        />

        {/* Animated grid overlay with drifting lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.03) 0.5px, transparent 0.5px),
              linear-gradient(to bottom, rgba(255,255,255,0.03) 0.5px, transparent 0.5px)
            `,
            backgroundSize: '64px 64px',
            animation: 'grid-drift 20s linear infinite',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
          }}
        />

        {/* Radial vignette — fades edges to #111114 */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 45%, transparent 0%, #111114 100%)',
          }}
        />
      </div>
    )
  }

  if (variant === 'cta') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
        {/* Purple/pink/yellow — dramatic CTA glow */}
        <div
          className="absolute -top-[30%] left-[20%] w-[60%] h-[100%] opacity-[0.3]"
          style={{ animation: 'aurora-drift-1 22s ease-in-out infinite' }}
        >
          <Image
            src="/gradients/blob-30.webp"
            alt=""
            fill
            className="object-contain"
            style={{ filter: 'blur(80px)' }}
          />
        </div>

        {/* Pink/cyan swirl — side accent */}
        <div
          className="absolute top-[10%] -right-[15%] w-[45%] h-[80%] opacity-[0.2]"
          style={{ animation: 'aurora-drift-2 28s ease-in-out infinite' }}
        >
          <Image
            src="/gradients/blob-42.webp"
            alt=""
            fill
            className="object-contain"
            style={{ filter: 'blur(60px)' }}
          />
        </div>
      </div>
    )
  }

  if (variant === 'section') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
        {/* Purple/pink/orange wave — gentle section wash */}
        <div
          className="absolute -top-[20%] left-[30%] w-[50%] h-[60%] opacity-[0.15]"
          style={{ animation: 'aurora-drift-1 25s ease-in-out infinite' }}
        >
          <Image
            src="/gradients/blob-46.webp"
            alt=""
            fill
            className="object-contain"
            style={{ filter: 'blur(80px)' }}
          />
        </div>

        {/* Cyan accent — opposite side */}
        <div
          className="absolute bottom-[-10%] -left-[10%] w-[35%] h-[45%] opacity-[0.12]"
          style={{ animation: 'aurora-drift-3 20s ease-in-out infinite' }}
        >
          <Image
            src="/gradients/blob-1.webp"
            alt=""
            fill
            className="object-contain"
            style={{ filter: 'blur(60px)' }}
          />
        </div>
      </div>
    )
  }

  // subtle variant
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      <div
        className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[50%] h-[40%] opacity-[0.1]"
        style={{ filter: 'blur(80px)' }}
      >
        <Image
          src="/gradients/blob-15.webp"
          alt=""
          fill
          className="object-contain"
        />
      </div>
    </div>
  )
}
