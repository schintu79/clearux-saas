/**
 * AIProviderIcon — renders the official brand logo for each AI provider
 * surfaced in AI X-Ray (Claude, ChatGPT, Gemini, Perplexity).
 *
 * The actual SVG files live in `public/assets/ai-providers/` so they
 * are served as static assets — no inline path data, no handmade
 * glyphs. Each logo carries its own brand color, so the `tone` prop
 * is accepted for backward compatibility but no longer recolors the
 * mark (recoloring a multi-color logo like Gemini's gradient would
 * break recognition).
 */

import React from 'react';

export type AIProvider = 'claude' | 'chatgpt' | 'gemini' | 'perplexity';

const BRAND_COLOR: Record<AIProvider, string> = {
  claude: '#D97757',
  chatgpt: '#10A37F',
  gemini: '#4285F4',
  perplexity: '#20B8CD',
};

const LOGO_SRC: Record<AIProvider, string> = {
  claude: '/assets/ai-providers/claude.svg',
  chatgpt: '/assets/ai-providers/chatgpt.svg',
  gemini: '/assets/ai-providers/gemini.svg',
  perplexity: '/assets/ai-providers/perplexity.svg',
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
}: {
  provider: AIProvider;
  size?: number;
  className?: string;
  title?: string;
  /** Accepted for backward compatibility; the official logos carry their own colors. */
  tone?: 'brand' | 'current';
}) {
  const label = title ?? `${PROVIDER_LABEL[provider]} logo`;
  return (
    <img
      src={LOGO_SRC[provider]}
      width={size}
      height={size}
      alt={title ? label : ''}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={className}
      style={{ display: 'block', objectFit: 'contain' }}
      draggable={false}
    />
  );
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
