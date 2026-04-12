'use client';

import React from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DashboardShell>
          <ErrorBoundary>{children}</ErrorBoundary>
        </DashboardShell>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default DashboardLayout;
