'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe } from 'lucide-react';

interface SiteFaviconProps {
  hostname: string;
  size?: number;
  className?: string;
}

/**
 * Favicon sources in priority order.
 * Google's service is fast but misses newer/less-indexed domains.
 * The site's own /favicon.ico is a reliable fallback.
 * DuckDuckGo's icon service is another good alternative.
 */
function getFaviconSources(hostname: string): string[] {
  const clean = hostname.replace(/^www\./, '');
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=128`,
    `https://${clean}/favicon.ico`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(clean)}.ico`,
  ];
}

export default function SiteFavicon({ hostname, size = 16, className }: SiteFaviconProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const prevHostRef = useRef(hostname);
  const sourcesRef = useRef<string[]>(getFaviconSources(hostname));

  // Reset when hostname changes
  useEffect(() => {
    if (prevHostRef.current !== hostname) {
      setSourceIndex(0);
      setAllFailed(false);
      sourcesRef.current = getFaviconSources(hostname);
      prevHostRef.current = hostname;
    }
  }, [hostname]);

  const handleError = useCallback(() => {
    const nextIndex = sourceIndex + 1;
    if (nextIndex < sourcesRef.current.length) {
      setSourceIndex(nextIndex);
    } else {
      setAllFailed(true);
    }
  }, [sourceIndex]);

  // Also detect Google's default 1x1 transparent globe by checking natural size
  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Google returns a 16x16 default globe for unknown domains even when sz=128 is requested
    if (sourceIndex === 0 && img.naturalWidth <= 16 && img.naturalHeight <= 16) {
      handleError();
    }
  }, [sourceIndex, handleError]);

  if (allFailed || !hostname) {
    // Letter avatar as final fallback — shows first letter of domain
    const letter = hostname?.replace(/^www\./, '').charAt(0).toUpperCase() || '?';
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md font-semibold flex-shrink-0${className ? ` ${className}` : ''}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(size * 0.5, 10),
          background: 'var(--ink)',
          color: 'var(--paper)',
        }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      key={`${hostname}-${sourceIndex}`}
      src={sourcesRef.current[sourceIndex]}
      alt=""
      width={size}
      height={size}
      onError={handleError}
      onLoad={handleLoad}
      className={`rounded-sm object-contain${className ? ` ${className}` : ''}`}
      style={{ flexShrink: 0 }}
    />
  );
}
