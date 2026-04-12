'use client';

import React from 'react';
import {
  Eye,
  Target,
  Map,
  Type,
  MousePointerClick,
  Smartphone,
  Shield,
  Gauge,
  Brain,
  AlertTriangle,
  Heart,
  Users,
  Sparkles,
  Globe,
  Zap,
  FileSearch,
  Accessibility,
  MonitorSmartphone,
  Palette,
  Layout,
  Code2,
  Search,
  MessageSquare,
  Lock,
  Timer,
  HandMetal,
  Puzzle,
  Languages,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   FindingVisual — Visual evidence card for each audit finding.
   Renders a category-aware illustration that gives the user
   instant visual context about what the issue is about.
   ───────────────────────────────────────────────────────── */

/* ── Category → visual theme mapping ──────────────────── */

interface VisualTheme {
  icon: React.ElementType;
  color: string;            // main accent color class
  bg: string;               // background gradient
  decorIcon1: React.ElementType;
  decorIcon2: React.ElementType;
  label: string;            // short label shown on the card
}

const CATEGORY_THEMES: Record<string, VisualTheme> = {
  // ═══ FOUNDATION ════════════════════════════════════════
  'first impression': {
    icon: Eye,
    color: 'text-violet-500',
    bg: 'from-violet-500/10 via-violet-500/5 to-purple-500/10',
    decorIcon1: Palette,
    decorIcon2: Layout,
    label: 'Visual Design',
  },
  'value proposition': {
    icon: Target,
    color: 'text-violet-500',
    bg: 'from-violet-500/10 via-purple-500/5 to-fuchsia-500/10',
    decorIcon1: MessageSquare,
    decorIcon2: Zap,
    label: 'Messaging',
  },
  'navigation': {
    icon: Map,
    color: 'text-violet-500',
    bg: 'from-violet-500/10 via-indigo-500/5 to-violet-500/10',
    decorIcon1: Layout,
    decorIcon2: Search,
    label: 'Navigation',
  },
  'visual hierarchy': {
    icon: Layout,
    color: 'text-violet-500',
    bg: 'from-purple-500/10 via-violet-500/5 to-indigo-500/10',
    decorIcon1: Eye,
    decorIcon2: Type,
    label: 'Layout',
  },
  'content quality': {
    icon: Type,
    color: 'text-violet-500',
    bg: 'from-indigo-500/10 via-violet-500/5 to-purple-500/10',
    decorIcon1: FileSearch,
    decorIcon2: MessageSquare,
    label: 'Content',
  },
  'calls-to-action': {
    icon: MousePointerClick,
    color: 'text-violet-500',
    bg: 'from-fuchsia-500/10 via-violet-500/5 to-purple-500/10',
    decorIcon1: Target,
    decorIcon2: Zap,
    label: 'Conversion',
  },

  // ═══ HUMAN EXPERIENCE ═════════════════════════════════
  'trust': {
    icon: Shield,
    color: 'text-pink-500',
    bg: 'from-pink-500/10 via-rose-500/5 to-pink-500/10',
    decorIcon1: Lock,
    decorIcon2: Users,
    label: 'Trust',
  },
  'ethical': {
    icon: AlertTriangle,
    color: 'text-pink-500',
    bg: 'from-rose-500/10 via-pink-500/5 to-red-500/10',
    decorIcon1: Shield,
    decorIcon2: Eye,
    label: 'Ethics',
  },
  'emotional': {
    icon: Heart,
    color: 'text-pink-500',
    bg: 'from-pink-500/10 via-rose-500/5 to-fuchsia-500/10',
    decorIcon1: MessageSquare,
    decorIcon2: Sparkles,
    label: 'Emotional',
  },
  'cognitive': {
    icon: Brain,
    color: 'text-pink-500',
    bg: 'from-fuchsia-500/10 via-pink-500/5 to-purple-500/10',
    decorIcon1: Puzzle,
    decorIcon2: Eye,
    label: 'Cognitive',
  },
  'digital wellbeing': {
    icon: Sparkles,
    color: 'text-pink-500',
    bg: 'from-pink-500/10 via-fuchsia-500/5 to-rose-500/10',
    decorIcon1: Timer,
    decorIcon2: Heart,
    label: 'Wellbeing',
  },
  'age inclusivity': {
    icon: Users,
    color: 'text-pink-500',
    bg: 'from-rose-500/10 via-pink-500/5 to-pink-500/10',
    decorIcon1: HandMetal,
    decorIcon2: Type,
    label: 'Inclusivity',
  },

  // ═══ TECHNICAL EXCELLENCE ═════════════════════════════
  'performance': {
    icon: Gauge,
    color: 'text-amber-500',
    bg: 'from-amber-500/10 via-yellow-500/5 to-orange-500/10',
    decorIcon1: Zap,
    decorIcon2: Timer,
    label: 'Speed',
  },
  'mobile': {
    icon: Smartphone,
    color: 'text-amber-500',
    bg: 'from-orange-500/10 via-amber-500/5 to-yellow-500/10',
    decorIcon1: MonitorSmartphone,
    decorIcon2: HandMetal,
    label: 'Mobile',
  },
  'accessibility': {
    icon: Accessibility,
    color: 'text-amber-500',
    bg: 'from-amber-500/10 via-orange-500/5 to-amber-500/10',
    decorIcon1: Eye,
    decorIcon2: Type,
    label: 'A11y',
  },
  'technical seo': {
    icon: FileSearch,
    color: 'text-amber-500',
    bg: 'from-yellow-500/10 via-amber-500/5 to-orange-500/10',
    decorIcon1: Code2,
    decorIcon2: Search,
    label: 'SEO',
  },

  // ═══ FUTURE READINESS ═════════════════════════════════
  'ai discoverability': {
    icon: Brain,
    color: 'text-emerald-500',
    bg: 'from-emerald-500/10 via-green-500/5 to-teal-500/10',
    decorIcon1: Search,
    decorIcon2: Code2,
    label: 'LLM Ready',
  },
  'ai agent': {
    icon: Zap,
    color: 'text-emerald-500',
    bg: 'from-teal-500/10 via-emerald-500/5 to-green-500/10',
    decorIcon1: Code2,
    decorIcon2: Puzzle,
    label: 'Agent Ready',
  },
  'cultural': {
    icon: Globe,
    color: 'text-emerald-500',
    bg: 'from-green-500/10 via-emerald-500/5 to-teal-500/10',
    decorIcon1: Languages,
    decorIcon2: Users,
    label: 'Global',
  },
};

/* ── Severity → visual accent ─────────────────────────── */

const SEVERITY_ACCENTS: Record<string, { ring: string; badge: string; badgeText: string }> = {
  critical: {
    ring: 'ring-red-500/20',
    badge: 'bg-red-500',
    badgeText: 'CRITICAL',
  },
  high: {
    ring: 'ring-orange-500/20',
    badge: 'bg-orange-500',
    badgeText: 'HIGH',
  },
  medium: {
    ring: 'ring-yellow-500/20',
    badge: 'bg-yellow-500',
    badgeText: 'MEDIUM',
  },
  low: {
    ring: 'ring-blue-500/20',
    badge: 'bg-blue-500',
    badgeText: 'LOW',
  },
};

/* ── Helper: match finding text to a theme ────────────── */

function getTheme(categoryName: string, findingTitle: string): VisualTheme {
  const text = `${categoryName} ${findingTitle}`.toLowerCase();

  // Try to match by category keywords
  for (const [keyword, theme] of Object.entries(CATEGORY_THEMES)) {
    if (text.includes(keyword)) return theme;
  }

  // Fallback: try secondary keyword matching
  if (text.includes('cta') || text.includes('button') || text.includes('click')) return CATEGORY_THEMES['calls-to-action'];
  if (text.includes('color') || text.includes('contrast') || text.includes('font')) return CATEGORY_THEMES['first impression'];
  if (text.includes('heading') || text.includes('h1') || text.includes('copy')) return CATEGORY_THEMES['content quality'];
  if (text.includes('form') || text.includes('input') || text.includes('label')) return CATEGORY_THEMES['accessibility'];
  if (text.includes('speed') || text.includes('load') || text.includes('lcp')) return CATEGORY_THEMES['performance'];
  if (text.includes('meta') || text.includes('schema') || text.includes('structured')) return CATEGORY_THEMES['technical seo'];
  if (text.includes('dark pattern') || text.includes('manipulat') || text.includes('deceptive')) return CATEGORY_THEMES['ethical'];
  if (text.includes('llm') || text.includes('chatgpt') || text.includes('claude')) return CATEGORY_THEMES['ai discoverability'];
  if (text.includes('rtl') || text.includes('i18n') || text.includes('translat')) return CATEGORY_THEMES['cultural'];

  // Default fallback
  return {
    icon: Sparkles,
    color: 'text-violet-500',
    bg: 'from-slate-500/10 via-gray-500/5 to-slate-500/10',
    decorIcon1: Eye,
    decorIcon2: Search,
    label: 'UX Issue',
  };
}

/* ── Component ────────────────────────────────────────── */

interface FindingVisualProps {
  title: string;
  severity: string;
  categoryName?: string;
  targetElement?: string | null;
  pageUrl?: string | null;
}

export default function FindingVisual({
  title,
  severity,
  categoryName = '',
  targetElement,
  pageUrl,
}: FindingVisualProps) {
  const theme = getTheme(categoryName, title);
  const accent = SEVERITY_ACCENTS[severity] || SEVERITY_ACCENTS.medium;
  const MainIcon = theme.icon;
  const Decor1 = theme.decorIcon1;
  const Decor2 = theme.decorIcon2;

  return (
    <div className={`relative rounded-xl overflow-hidden bg-gradient-to-br ${theme.bg} ring-1 ${accent.ring}`}>
      {/* Top severity badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white tracking-wider ${accent.badge}`}>
          {accent.badgeText}
        </span>
      </div>

      {/* Card body */}
      <div className="relative px-5 py-5 flex items-center gap-5">
        {/* Left: Main icon */}
        <div className="relative flex-shrink-0">
          {/* Glow behind icon */}
          <div className={`absolute inset-0 blur-xl rounded-full ${theme.bg} opacity-60`} />
          <div className={`relative w-14 h-14 rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-sm border border-white/40 dark:border-white/10`}>
            <MainIcon size={26} className={theme.color} strokeWidth={1.5} />
          </div>
        </div>

        {/* Center: Finding info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.color}`}>
              {theme.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-text leading-snug line-clamp-2">
            {title}
          </p>
          {targetElement && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Code2 size={10} className="text-muted flex-shrink-0" />
              <code className="text-[10px] text-muted font-mono truncate max-w-[200px]">
                {targetElement}
              </code>
            </div>
          )}
          {pageUrl && (
            <p className="text-[10px] text-muted mt-1 truncate">
              {(() => {
                try { return new URL(pageUrl).pathname || '/'; }
                catch { return pageUrl; }
              })()}
            </p>
          )}
        </div>

        {/* Right: Decorative icons */}
        <div className="hidden sm:flex flex-col gap-3 flex-shrink-0 opacity-[0.15] dark:opacity-[0.1]">
          <Decor1 size={28} className={theme.color} strokeWidth={1} />
          <Decor2 size={28} className={theme.color} strokeWidth={1} />
        </div>
      </div>

      {/* Bottom gradient line */}
      <div
        className="h-[2px] w-full"
        style={{
          background:
            severity === 'critical'
              ? 'linear-gradient(90deg, #EF4444 0%, #F59E0B 50%, #EF4444 100%)'
              : severity === 'high'
                ? 'linear-gradient(90deg, #F97316 0%, #FBBF24 50%, #F97316 100%)'
                : severity === 'medium'
                  ? 'linear-gradient(90deg, #EAB308 0%, #A3E635 50%, #EAB308 100%)'
                  : 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 50%, #3B82F6 100%)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}
