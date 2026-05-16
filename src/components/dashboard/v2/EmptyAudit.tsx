'use client';

/**
 * EmptyAudit — the "no audit yet" state shared by Overview, Find, Fix, Track.
 * Single CTA: enter a URL and run the first audit. Mirrors the bible's
 * "every empty state has an action" rule.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

interface EmptyAuditProps {
  title?: string;
  body?: string;
}

const EmptyAudit: React.FC<EmptyAuditProps> = ({
  title = 'No audit yet',
  body = 'Run your first ClearUX audit to see what is hurting your score and what to fix first.',
}) => {
  const [url, setUrl] = useState('');
  const href = url.trim()
    ? `/dashboard/new-audit?url=${encodeURIComponent(url.trim())}`
    : '/dashboard/new-audit';
  return (
    <div
      className="rounded-xl p-8 flex flex-col items-start gap-5"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      data-testid="empty-audit"
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center"
        style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)' }}
      >
        <Sparkles size={20} strokeWidth={1.6} style={{ color: 'var(--signal)' }} />
      </div>
      <div>
        <h2 className="text-[18px] font-sans font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </h2>
        <p className="text-[13px] mt-1.5 max-w-[520px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
          {body}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-[560px]">
        <input
          type="url"
          inputMode="url"
          placeholder="https://your-website.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          aria-label="Website URL"
        />
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          Run audit
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};

export default EmptyAudit;
