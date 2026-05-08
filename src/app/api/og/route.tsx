// ============================================================
// ClearUX — Dynamic OG Image Generation
// GET /api/og — returns a 1200x630 PNG for social sharing
// ============================================================

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0f0f12 0%, #1a1025 40%, #0f0f12 100%)',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '200px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.15)',
            filter: 'blur(100px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '100px',
            right: '250px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(236, 72, 153, 0.1)',
            filter: 'blur(80px)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 500,
            }}
          >
            C
          </div>
          <span style={{ fontSize: '36px', fontWeight: 500, color: 'white' }}>
            Clear<span style={{ color: '#8B5CF6' }}>UX</span>
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '52px',
            fontWeight: 500,
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.15,
            maxWidth: '900px',
            marginBottom: '20px',
          }}
        >
          AI-Powered UX Audits
          <br />
          <span style={{ color: '#a78bfa' }}>That Go Beyond the Checklist</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '22px',
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            maxWidth: '700px',
            marginBottom: '40px',
          }}
        >
          64 checkpoints across accessibility, ethics, AI readiness, and conversion — prioritised by business impact.
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '48px',
          }}
        >
          {[
            { num: '64', label: 'Checkpoints' },
            { num: '16', label: 'Categories' },
            { num: '4', label: 'Pillars' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '36px',
                  fontWeight: 500,
                  background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {stat.num}
              </span>
              <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
