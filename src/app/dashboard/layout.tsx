import React from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import ErrorBoundary from '@/components/ErrorBoundary';

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
