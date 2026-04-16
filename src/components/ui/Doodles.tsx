'use client';

import React from 'react';

/* ══════════════════════════════════════════════════════════════
   Hand-drawn SVG doodles — arrows, scribbles, squiggles
   Sketch-style decorative elements to add personality & direct attention
   ══════════════════════════════════════════════════════════════ */

interface DoodleProps {
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}

/* ── Curvy arrow pointing right — loops back then swoops forward ── */
export function ArrowCurvy({ className = '', color = 'var(--color-foundation)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M8 35C18 45 35 48 45 38C55 28 42 18 30 25C22 30 28 42 50 38C65 35 80 28 95 30"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"
      />
      <path
        d="M88 24L96 30L87 35"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"
      />
    </svg>
  );
}

/* ── Curvy arrow pointing down — swoops from left ── */
export function DoodleArrowDown({ className = '', color = 'var(--color-human)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="60" height="100" viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M15 8C10 20 8 35 18 45C28 55 40 42 35 30C30 22 18 28 22 50C25 65 30 78 28 88"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.45"
      />
      <path
        d="M22 82L28 90L34 81"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.45"
      />
    </svg>
  );
}

/* ── Loose scribble / squiggle — horizontal energy burst ── */
export function Squiggle({ className = '', color = 'var(--color-tech)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="140" height="35" viewBox="0 0 140 35" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M5 18C15 8 22 28 32 18C42 8 48 28 58 18C68 8 75 28 85 18C95 8 102 28 112 18C122 8 128 28 135 18"
        stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.35"
      />
    </svg>
  );
}

/* ── Circle scribble — hand-drawn emphasis ring ── */
export function CircleScribble({ className = '', color = 'var(--color-foundation)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="100" height="80" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M50 8C72 6 92 18 90 40C88 58 68 72 48 70C28 68 10 54 12 36C14 20 30 10 50 8C58 7 65 10 68 15"
        stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3"
      />
    </svg>
  );
}

/* ── Star / sparkle burst — small accent ── */
export function Sparkle({ className = '', color = 'var(--color-tech)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M14 2C14 2 16 10 14 14C14 14 10 14 2 14C2 14 10 16 14 14C14 14 14 22 14 26C14 26 16 18 14 14C14 14 22 14 26 14C26 14 18 12 14 14"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4"
      />
    </svg>
  );
}

/* ── Underline scribble — wobbly double underline ── */
export function UnderlineScribble({ className = '', color = 'var(--color-human)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="180" height="20" viewBox="0 0 180 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M5 8C30 12 60 6 90 10C120 14 150 6 175 10"
        stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.35"
      />
      <path
        d="M10 14C35 18 65 11 95 15C125 19 155 12 170 15"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.2"
      />
    </svg>
  );
}

/* ── Zigzag arrow pointing down-right ── */
export function ArrowZigzag({ className = '', color = 'var(--color-future)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M10 12L30 32L18 35L45 58L35 60L62 72"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4"
      />
      <path
        d="M55 65L63 73L65 62"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4"
      />
    </svg>
  );
}

/* ── Loose spiral — small decorative accent ── */
export function Spiral({ className = '', color = 'var(--color-trust)', style }: DoodleProps) {
  return (
    <svg className={className} style={style} width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M25 20C28 18 32 20 32 25C32 30 27 33 22 32C16 30 14 24 17 19C21 13 29 12 34 16C40 21 40 32 34 38"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.3"
      />
    </svg>
  );
}
