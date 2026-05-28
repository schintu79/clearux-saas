'use client';

/**
 * Workspace-scoped dashboard layout.
 *
 * Reads the [slug] param from the URL and wraps children in a
 * WorkspaceProvider so every page under /dashboard/[slug]/*
 * has access to the resolved workspace via useWorkspace().
 *
 * AuditBundleProvider is mounted INSIDE WorkspaceProvider so it
 * can read workspace_id and scope audit queries accordingly.
 */

import React from 'react';
import { useParams } from 'next/navigation';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { AuditBundleProvider } from '@/context/AuditBundleContext';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  return (
    <WorkspaceProvider slug={slug}>
      <AuditBundleProvider>
        {children}
      </AuditBundleProvider>
    </WorkspaceProvider>
  );
}
