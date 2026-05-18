'use client';

/**
 * FindingText — renders Finding/Fix/Impact body strings as readable
 * blocks instead of one dense paragraph.
 *
 * It splits on blank lines, recognises lists (lines starting with -, *,
 * digit-dot, bullet), and renders fenced code/JSON-ish blocks in a
 * monospaced wrapping container. URLs are made clickable. Nothing is
 * invented — only the source text is reformatted.
 */

import React from 'react';

type Tone = 'default' | 'fix';

interface Props {
  text: string | null | undefined;
  tone?: Tone;
  className?: string;
}

const URL_RE = /(https?:\/\/[^\s)<>"']+)/g;

function isCodeyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^[{[].*[}\]],?$/.test(t)) return true;
  if (/^<[a-z!/]/i.test(t)) return true;
  if (/^(import|export|function|const|let|var|return|if|else|for|while)\b/.test(t)) return true;
  return false;
}

function isListLine(line: string): { ok: true; marker: string; rest: string } | { ok: false } {
  const m = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/);
  if (!m) return { ok: false };
  return { ok: true, marker: m[1] || `${m[2]}.`, rest: m[3] };
}

function renderInline(text: string): React.ReactNode {
  if (!URL_RE.test(text)) {
    URL_RE.lastIndex = 0;
    return text;
  }
  URL_RE.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const url = m[1];
    parts.push(
      <a
        key={`u-${i++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline decoration-dotted underline-offset-2 hover:decoration-solid"
        style={{ color: 'var(--signal)' }}
      >
        {url}
      </a>,
    );
    last = m.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function looksLikeCodeBlock(block: string): boolean {
  const lines = block.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return false;
  const codey = lines.filter(isCodeyLine).length;
  return codey / lines.length >= 0.6;
}

export default function FindingText({ text, tone = 'default', className }: Props) {
  const raw = (text || '').trim();
  if (!raw) {
    return (
      <p className={`text-[12px] italic ${className || ''}`} style={{ color: 'var(--m-muted)' }}>
        Nothing captured for this section.
      </p>
    );
  }

  // Split on blank lines into blocks.
  const blocks = raw
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const baseColor = tone === 'fix' ? 'var(--ink)' : 'var(--ink-2)';
  const baseWeight = tone === 'fix' ? 'font-medium' : '';

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {blocks.map((block, bi) => {
        // Code-ish block → monospaced container
        if (looksLikeCodeBlock(block)) {
          return (
            <pre
              key={bi}
              className="text-[12px] leading-[1.55] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono"
              style={{
                background: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                color: 'var(--ink)',
              }}
            >
              {block}
            </pre>
          );
        }

        // List block → render as <ul>/<ol>
        const lines = block.split('\n');
        const listItems: Array<{ marker: string; rest: string }> = [];
        let allList = lines.length > 0;
        for (const line of lines) {
          const r = isListLine(line);
          if (!r.ok) { allList = false; break; }
          listItems.push({ marker: r.marker, rest: r.rest });
        }
        if (allList && listItems.length > 1) {
          const ordered = /^\d/.test(listItems[0].marker);
          const ListTag = ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={bi}
              className={`text-[13px] leading-[1.65] pl-5 space-y-1 ${baseWeight}`}
              style={{ color: baseColor, listStyleType: ordered ? 'decimal' : 'disc' }}
            >
              {listItems.map((li, i) => (
                <li key={i}>{renderInline(li.rest)}</li>
              ))}
            </ListTag>
          );
        }

        // Plain paragraph
        return (
          <p
            key={bi}
            className={`text-[13px] leading-[1.65] whitespace-pre-wrap ${baseWeight}`}
            style={{ color: baseColor }}
          >
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}
