'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';

interface SiteFaviconProps {
  hostname: string;
  size?: number;
  className?: string;
}

export default function SiteFavicon({ hostname, size = 16, className }: SiteFaviconProps) {
  const [error, setError] = useState(false);
  const prevHostRef = useRef(hostname);

  // Reset error state when hostname changes so a new favicon can load
  useEffect(() => {
    if (prevHostRef.current !== hostname) {
      setError(false);
      prevHostRef.current = hostname;
    }
  }, [hostname]);

  if (error || !hostname) {
    return <Globe size={size} strokeWidth={1.75} className={className} />;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`}
      alt=""
      width={size}
      height={size}
      onError={() => setError(true)}
      className={`rounded-sm object-contain${className ? ` ${className}` : ''}`}
      style={{ flexShrink: 0 }}
    />
  );
}
