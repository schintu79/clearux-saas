import React from 'react';
import type { Metadata } from 'next';
import DashboardShell from '@/components/layout/DashboardShell';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Your UX Audit Reports',
  description: 'View your audit results, download reports, and track improvements across your websites and brand identities.',
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <DashboardShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </DashboardShell>
    </ErrorBoundary>
  );
};

export default DashboardLayout;
