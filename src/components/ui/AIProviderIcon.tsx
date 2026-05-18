/**
 * AIProviderIcon — brand-accurate SVG marks for the four AI providers
 * surfaced in AI X-Ray (Claude, ChatGPT, Gemini, Perplexity).
 *
 * Each icon is an inline SVG of the provider's public glyph (Anthropic
 * burst, OpenAI knot, Gemini four-point spark, Perplexity ring + bars).
 * No remote assets, no logo files — keeps the dashboard quiet and
 * dependency-free, and avoids shipping any image we don't have a
 * trademark license for.
 *
 * Two coloring modes:
 *   - `tone="brand"` (default) renders each glyph in the provider's
 *     well-known brand hue so the row is recognizable at a glance —
 *     Claude orange, OpenAI green/black, Gemini blue, Perplexity teal.
 *   - `tone="current"` falls back to `currentColor` so the parent can
 *     tint the glyph with the accuracy color (ok/warn/severe/muted).
 *     This is what the score chips on the AI X-Ray cards use.
 */

import React from 'react';

export type AIProvider = 'claude' | 'chatgpt' | 'gemini' | 'perplexity';

const BRAND_COLOR: Record<AIProvider, string> = {
  claude: '#D97757',
  chatgpt: '#10A37F',
  gemini: '#4285F4',
  perplexity: '#20B8CD',
};

export const PROVIDER_LABEL: Record<AIProvider, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
};

export const PROVIDER_SUBTITLE: Record<AIProvider, string> = {
  claude: 'Anthropic Claude',
  chatgpt: 'OpenAI GPT-4o',
  gemini: 'Google Gemini',
  perplexity: 'Perplexity Sonar',
};

export function providerBrandColor(provider: AIProvider): string {
  return BRAND_COLOR[provider];
}

export function AIProviderIcon({
  provider,
  size = 14,
  className,
  title,
  tone = 'brand',
}: {
  provider: AIProvider;
  size?: number;
  className?: string;
  title?: string;
  tone?: 'brand' | 'current';
}) {
  const fill = tone === 'brand' ? BRAND_COLOR[provider] : 'currentColor';
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill,
    'aria-hidden': title ? undefined : (true as any),
    role: title ? 'img' : undefined,
    className,
  };
  switch (provider) {
    case 'claude':
      // Anthropic "asterisk burst" — eight-point star approximating the
      // official Claude/Anthropic mark (four long primary rays + four
      // shorter secondary rays).
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path d="M12 1.5c.27 3.6 1.18 6.07 2.73 7.4 1.55 1.33 4.13 2.13 7.77 2.4v.2c-3.64.27-6.22 1.07-7.77 2.4-1.55 1.33-2.46 3.8-2.73 7.4-.27-3.6-1.18-6.07-2.73-7.4C7.72 12.57 5.14 11.77 1.5 11.5v-.2c3.64-.27 6.22-1.07 7.77-2.4C10.82 7.57 11.73 5.1 12 1.5z" />
          <path opacity="0.55" d="M19.4 4.6c.07 1.36.45 2.3 1.04 2.82.59.52 1.55.82 2.93.92v.04c-1.38.1-2.34.4-2.93.92-.59.52-.97 1.46-1.04 2.82-.07-1.36-.45-2.3-1.04-2.82-.59-.52-1.55-.82-2.93-.92v-.04c1.38-.1 2.34-.4 2.93-.92.59-.52.97-1.46 1.04-2.82zM4.6 13.6c.07 1.36.45 2.3 1.04 2.82.59.52 1.55.82 2.93.92v.04c-1.38.1-2.34.4-2.93.92-.59.52-.97 1.46-1.04 2.82-.07-1.36-.45-2.3-1.04-2.82-.59-.52-1.55-.82-2.93-.92v-.04c1.38-.1 2.34-.4 2.93-.92.59-.52.97-1.46 1.04-2.82z" />
        </svg>
      );
    case 'chatgpt':
      // OpenAI / ChatGPT trefoil knot — the six-fold interlocked
      // hexagonal shape that appears on chatgpt.com and OpenAI's docs.
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path d="M21.55 10.04a5.4 5.4 0 0 0-.46-4.43 5.46 5.46 0 0 0-5.88-2.62A5.43 5.43 0 0 0 11.06 1.2a5.46 5.46 0 0 0-5.2 3.78A5.42 5.42 0 0 0 2.25 7.4a5.46 5.46 0 0 0 .67 6.4 5.4 5.4 0 0 0 .46 4.43 5.46 5.46 0 0 0 5.88 2.62 5.43 5.43 0 0 0 4.15 1.79 5.46 5.46 0 0 0 5.2-3.78 5.42 5.42 0 0 0 3.62-2.42 5.46 5.46 0 0 0-.68-6.4zM13.42 20.6a4.05 4.05 0 0 1-2.6-.94l.13-.07 4.32-2.5a.7.7 0 0 0 .35-.61v-6.1l1.83 1.06c.02.01.03.03.03.05v5.05a4.06 4.06 0 0 1-4.06 4.06zM4.7 16.88a4.05 4.05 0 0 1-.48-2.72l.13.08 4.32 2.5a.7.7 0 0 0 .7 0l5.27-3.04v2.11a.06.06 0 0 1-.03.05l-4.37 2.52a4.06 4.06 0 0 1-5.54-1.5zM3.56 7.92a4.05 4.05 0 0 1 2.12-1.78v5.14a.7.7 0 0 0 .35.6l5.25 3.04-1.83 1.06a.06.06 0 0 1-.06 0L4.96 13.45a4.06 4.06 0 0 1-1.4-5.53zm14.92 3.47-5.27-3.05 1.83-1.05a.06.06 0 0 1 .06 0l4.42 2.55a4.06 4.06 0 0 1-.61 7.32v-5.15a.7.7 0 0 0-.43-.62zm1.82-2.73-.13-.08-4.32-2.5a.7.7 0 0 0-.7 0L9.88 9.12V7a.06.06 0 0 1 .03-.05l4.37-2.52a4.06 4.06 0 0 1 6.02 4.2zM8.88 13.45 7.05 12.4a.06.06 0 0 1-.03-.05V7.32a4.06 4.06 0 0 1 6.66-3.11l-.13.08-4.32 2.5a.7.7 0 0 0-.35.6l-.01 6.06zm.99-2.14L12.22 9.96l2.35 1.35v2.7l-2.35 1.35-2.35-1.35z" />
        </svg>
      );
    case 'gemini':
      // Google Gemini "Spark of Curiosity" — four-point star with
      // concave sides, matching the glyph used on gemini.google.com.
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path d="M12 2c.4 3.2 1.46 5.76 3.2 7.5C16.94 11.24 19.5 12.3 22.7 12.7v-.04c-3.2.4-5.76 1.46-7.5 3.2-1.74 1.74-2.8 4.3-3.2 7.5-.4-3.2-1.46-5.76-3.2-7.5C7.06 14.12 4.5 13.06 1.3 12.66v-.04c3.2-.4 5.76-1.46 7.5-3.2C10.54 7.76 11.6 5.2 12 2z" />
        </svg>
      );
    case 'perplexity':
      // Perplexity — capital "P" glyph from the Perplexity brand mark
      // (vertical stem + rounded bowl), simplified.
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path
            d="M5.5 3.5h7.25a4.75 4.75 0 0 1 0 9.5H8.5v7.5H5.5V3.5zm3 2.6v4.3h4.25a2.15 2.15 0 0 0 0-4.3H8.5z"
          />
        </svg>
      );
  }
}

/**
 * Map an internal model_id (claude / gpt4o / gemini / perplexity) to a
 * provider key. Returns null for unknown IDs so callers can degrade
 * gracefully instead of rendering the wrong logo.
 */
export function providerKeyToIcon(key: string): AIProvider | null {
  if (key === 'claude') return 'claude';
  if (key === 'gpt4o' || key === 'chatgpt' || key === 'openai') return 'chatgpt';
  if (key === 'gemini' || key === 'google') return 'gemini';
  if (key === 'perplexity') return 'perplexity';
  return null;
}
