import React from 'react';
import AdminShell from '@/components/layout/AdminShell';
import ErrorBoundary from '@/components/ErrorBoundary';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <AdminShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AdminShell>
    </ErrorBoundary>
  );
};

export default AdminLayout;
