'use client'

import React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useUser } from '@/hooks/useUser';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Once auth is resolved and there's no user, redirect to login
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // While checking auth, show a minimal loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // No user after loading → will redirect, show nothing
  if (!user) {
    return null;
  }

  return (
    <ErrorBoundary>
      <DashboardShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </DashboardShell>
    </ErrorBoundary>
  );
};

export default DashboardLayout;
