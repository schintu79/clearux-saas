import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Fixpath Dashboard Preview',
  description: 'Static design preview of the Fixpath.ai dashboard direction. Uses mock data only.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
