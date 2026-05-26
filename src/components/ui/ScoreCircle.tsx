'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * ScoreCircle — unified score ring component.
 *
 * Four standardised sizes, proportionally scaled from the 160px reference:
 *
 *  | Size   | px  | stroke | font | ratio |
 *  |--------|-----|--------|------|-------|
 *  | big    | 160 |   10   |  42  | 1.00  |
 *  | medium | 100 |    6   |  26  | 0.625 |
 *  | normal |  80 |    5   |  21  | 0.50  |
 *  | small  |  56 |    4   |  15  | 0.35  |
 *
 * Color logic:
 *  - 80–100: --ok (green)
 *  - 60–79:  --warn (amber)
 *  - 0–59:   --severe (red)
 *
 * Animates ring fill from 0 → score on mount (300ms ease-out).
 * Respects prefers-reduced-motion.
 */

const SIZE_MAP = {
  big:    { px: 160, stroke: 10, fontSize: 42, fontWeight: 700 },
  medium: { px: 100, stroke:  6, fontSize: 26, fontWeight: 700 },
  normal: { px:  80, stroke:  5, fontSize: 21, fontWeight: 700 },
  small:  { px:  56, stroke:  4, fontSize: 15, fontWeight: 700 },
} as const;

type ScoreSize = keyof typeof SIZE_MAP;

function getScoreColor(value: number): string {
  if (value >= 80) return 'var(--ok)';
  if (value >= 60) return 'var(--warn)';
  return 'var(--severe)';
}

interface ScoreCircleProps {
  /** Score 0–100 */
  score: number | null;
  /** Visual size variant: big (160), medium (100), normal (80), small (56) */
  size?: ScoreSize;
  /** Optional className on the wrapper */
  className?: string;
}

export default function ScoreCircle({
  score,
  size = 'small',
  className,
}: ScoreCircleProps) {
  const config = SIZE_MAP[size];
  const totalPx = config.px;
  const stroke = config.stroke;
  const radius = (totalPx - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const targetScore = score ?? 0;
  const hasScore = score != null;

  // Animate from 0 → score over 300ms using requestAnimationFrame
  useEffect(() => {
    if (!hasScore) {
      setAnimatedScore(0);
      return;
    }

    // Check for reduced motion preference
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (prefersReduced) {
      setAnimatedScore(targetScore);
      return;
    }

    startRef.current = null;
    const from = 0;
    const to = targetScore;
    const duration = 300;

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetScore, hasScore]);

  const offset = circumference - (animatedScore / 100) * circumference;
  const color = hasScore ? getScoreColor(animatedScore) : 'var(--m-muted)';

  return (
    <div
      className={`relative flex-shrink-0 ${className ?? ''}`}
      style={{ width: totalPx, height: totalPx }}
    >
      <svg width={totalPx} height={totalPx} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={totalPx / 2}
          cy={totalPx / 2}
          r={radius}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={stroke}
        />
        {/* Progress ring */}
        {hasScore && (
          <circle
            cx={totalPx / 2}
            cy={totalPx / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      {/* Centered number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-sans text-center tabular-nums"
          style={{
            fontSize: `${config.fontSize}px`,
            fontWeight: config.fontWeight,
            color,
            lineHeight: 1,
          }}
        >
          {hasScore ? Math.round(animatedScore) : '—'}
        </span>
      </div>
    </div>
  );
}

/** Re-export the color helper so consumers can match colors elsewhere */
export { getScoreColor };
