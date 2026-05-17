/**
 * AIProviderIcon — small SVG marks for AI providers used in
 * AI X-Ray (Overview and /dashboard/ai-readability#x-ray).
 *
 * Icons are inline SVGs based on each provider's public brand glyph
 * (Claude burst, OpenAI knot, Gemini sparkle, Perplexity orbit). They
 * render with `currentColor` so the parent can tint them with the
 * accuracy score color (ok / warn / severe / muted). No remote assets,
 * no logo files — keeps the dashboard quiet and dependency-free.
 */

import React from 'react';

type Provider = 'claude' | 'chatgpt' | 'gemini' | 'perplexity';

export function AIProviderIcon({
  provider,
  size = 14,
  className,
  title,
}: {
  provider: Provider;
  size?: number;
  className?: string;
  title?: string;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': title ? undefined : (true as any),
    role: title ? 'img' : undefined,
    className,
  };
  switch (provider) {
    case 'claude':
      // Anthropic / Claude burst — stylized 4-point radial mark.
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path d="M12 2.4c.34 2.66 1.32 4.86 2.94 6.6 1.62 1.74 3.74 2.76 6.36 3.06v.04c-2.62.3-4.74 1.32-6.36 3.06C13.32 16.9 12.34 19.1 12 21.76c-.34-2.66-1.32-4.86-2.94-6.6C7.44 13.42 5.32 12.4 2.7 12.1v-.04c2.62-.3 4.74-1.32 6.36-3.06C10.68 7.26 11.66 5.06 12 2.4z" />
        </svg>
      );
    case 'chatgpt':
      // OpenAI / ChatGPT trefoil knot — six-fold flower silhouette.
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path d="M21.55 10.04a5.4 5.4 0 0 0-.46-4.43 5.46 5.46 0 0 0-5.88-2.62A5.43 5.43 0 0 0 11.06 1.2a5.46 5.46 0 0 0-5.2 3.78A5.42 5.42 0 0 0 2.25 7.4a5.46 5.46 0 0 0 .67 6.4 5.4 5.4 0 0 0 .46 4.43 5.46 5.46 0 0 0 5.88 2.62 5.43 5.43 0 0 0 4.15 1.79 5.46 5.46 0 0 0 5.2-3.78 5.42 5.42 0 0 0 3.62-2.42 5.46 5.46 0 0 0-.68-6.4zM13.42 20.6a4.05 4.05 0 0 1-2.6-.94l.13-.07 4.32-2.5a.7.7 0 0 0 .35-.61v-6.1l1.83 1.06c.02.01.03.03.03.05v5.05a4.06 4.06 0 0 1-4.06 4.06zM4.7 16.88a4.05 4.05 0 0 1-.48-2.72l.13.08 4.32 2.5a.7.7 0 0 0 .7 0l5.27-3.04v2.11a.06.06 0 0 1-.03.05l-4.37 2.52a4.06 4.06 0 0 1-5.54-1.5zM3.56 7.92a4.05 4.05 0 0 1 2.12-1.78v5.14a.7.7 0 0 0 .35.6l5.25 3.04-1.83 1.06a.06.06 0 0 1-.06 0L4.96 13.45a4.06 4.06 0 0 1-1.4-5.53zm14.92 3.47-5.27-3.05 1.83-1.05a.06.06 0 0 1 .06 0l4.42 2.55a4.06 4.06 0 0 1-.61 7.32v-5.15a.7.7 0 0 0-.43-.62zm1.82-2.73-.13-.08-4.32-2.5a.7.7 0 0 0-.7 0L9.88 9.12V7a.06.06 0 0 1 .03-.05l4.37-2.52a4.06 4.06 0 0 1 6.02 4.2zM8.88 13.45 7.05 12.4a.06.06 0 0 1-.03-.05V7.32a4.06 4.06 0 0 1 6.66-3.11l-.13.08-4.32 2.5a.7.7 0 0 0-.35.6l-.01 6.06zm.99-2.14L12.22 9.96l2.35 1.35v2.7l-2.35 1.35-2.35-1.35z" />
        </svg>
      );
    case 'gemini':
      // Gemini four-point sparkle — Google's official Gemini glyph
      // is a four-pointed star with concave sides ("Spark of Curiosity").
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path d="M12 2c.18 3.06 1.23 5.6 3.14 7.6C17.07 11.62 19.64 12.7 22 12c-3.06.18-5.6 1.23-7.6 3.14C12.38 17.07 11.3 19.64 12 22c-.18-3.06-1.23-5.6-3.14-7.6C6.93 12.38 4.36 11.3 2 12c3.06-.18 5.6-1.23 7.6-3.14C11.62 6.93 12.7 4.36 12 2z" />
        </svg>
      );
    case 'perplexity':
      // Perplexity — abstract orbit / star mark (simplified).
      return (
        <svg {...props}>
          {title && <title>{title}</title>}
          <path d="M12 2.5a.7.7 0 0 1 .7.7v3.66l5.5-4.13a.7.7 0 0 1 1.12.56v5.32H21a.7.7 0 0 1 .7.7v5.38a.7.7 0 0 1-.7.7h-1.68v5.32a.7.7 0 0 1-1.12.56l-5.5-4.13v3.66a.7.7 0 1 1-1.4 0v-3.66l-5.5 4.13a.7.7 0 0 1-1.12-.56v-5.32H3a.7.7 0 0 1-.7-.7V9.3a.7.7 0 0 1 .7-.7h1.68V3.3a.7.7 0 0 1 1.12-.56l5.5 4.13V3.2a.7.7 0 0 1 .7-.7zm-.7 6.62L6.08 5.03v5.27a.7.7 0 0 1-.7.7H3.7v3.98h1.68a.7.7 0 0 1 .7.7v5.27l5.22-4.09a.7.7 0 0 1 .43-.15h.06v-7.43h-.06a.7.7 0 0 1-.43-.15zm1.4-.04v7.84l5.22 4.09v-5.27a.7.7 0 0 1 .7-.7h1.68V10h-1.68a.7.7 0 0 1-.7-.7V5.03l-5.22 4.09v-.04z" />
        </svg>
      );
  }
}

export function providerKeyToIcon(key: string): Provider | null {
  if (key === 'claude') return 'claude';
  if (key === 'gpt4o' || key === 'chatgpt' || key === 'openai') return 'chatgpt';
  if (key === 'gemini' || key === 'google') return 'gemini';
  if (key === 'perplexity') return 'perplexity';
  return null;
}
