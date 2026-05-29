'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, User, Building2, CreditCard, Settings as SettingsIcon, Cpu, RefreshCw, AlertTriangle, HardDrive } from 'lucide-react';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Button from '@/components/ui/Button';
import DashCard from '@/components/dashboard/v2/DashCard';
import { AIProviderIcon, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import { useWorkspace } from '@/context/WorkspaceContext';

interface ProfileFormData {
  full_name: string;
  company: string;
}

interface PasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

interface BillingFormData {
  company_name: string;
  vat_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  country: string;
}

interface FormState {
  profile: ProfileFormData;
  password: PasswordFormData;
  billing: BillingFormData;
}

interface Messages {
  profileSuccess?: string;
  profileError?: string;
  passwordSuccess?: string;
  passwordError?: string;
  billingSuccess?: string;
  billingError?: string;
}

interface AIModelUI {
  slug: string;
  displayName: string;
  provider: string;
  shortId: string;
  productName?: string;
  enabled: boolean;
  useForCompetitors: boolean;
  useForVoice: boolean;
  useForAnswers: boolean;
  useForReports: boolean;
}

type TabId = 'profile' | 'company' | 'security' | 'ai_models' | 'ftp';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company & Billing', icon: Building2 },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'ai_models', label: 'AI Models', icon: Cpu },
  { id: 'ftp', label: 'FTP / SFTP', icon: HardDrive },
];

const SettingsPage: React.FC = () => {
  const { user, profile, loading: userLoading, refreshProfile } = useAuth();
  const { workspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [formState, setFormState] = useState<FormState>({
    profile: {
      full_name: '',
      company: '',
    },
    password: {
      newPassword: '',
      confirmPassword: '',
    },
    billing: {
      company_name: '',
      vat_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      postal_code: '',
      country: '',
    },
  });
  const [messages, setMessages] = useState<Messages>({});
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [profileChanged, setProfileChanged] = useState(false);
  const [billingChanged, setBillingChanged] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // AI Models state
  const [aiModels, setAiModels] = useState<AIModelUI[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelsSaving, setAiModelsSaving] = useState(false);
  const [aiModelsMessage, setAiModelsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [refreshingModels, setRefreshingModels] = useState(false);

  // FTP state
  const [ftpForm, setFtpForm] = useState({
    label: '',
    protocol: 'sftp' as 'ftp' | 'sftp',
    host: '',
    port: '22',
    username: '',
    password: '',
    remote_path: '/',
  });
  const [ftpConnections, setFtpConnections] = useState<any[]>([]);
  const [ftpLoading, setFtpLoading] = useState(false);
  const [ftpSaving, setFtpSaving] = useState(false);
  const [ftpTesting, setFtpTesting] = useState(false);
  const [ftpMessage, setFtpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAIModels = useCallback(async () => {
    setAiModelsLoading(true);
    try {
      const res = await fetch('/api/ai-models');
      if (!res.ok) throw new Error('Failed to load AI models');
      const data = await res.json();
      setAiModels(data.models || []);
    } catch (err) {
      setAiModelsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load AI models' });
    } finally {
      setAiModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ai_models' && aiModels.length === 0 && !aiModelsLoading) {
      fetchAIModels();
    }
  }, [activeTab, aiModels.length, aiModelsLoading, fetchAIModels]);

  const handleAIModelToggle = (slug: string, field: keyof AIModelUI) => {
    setAiModels((prev) =>
      prev.map((m) =>
        m.slug === slug ? { ...m, [field]: !m[field as keyof AIModelUI] } : m,
      ),
    );
  };

  const saveAIModelSettings = async () => {
    setAiModelsSaving(true);
    setAiModelsMessage(null);
    try {
      const settings = aiModels.map((m) => ({
        model_slug: m.slug,
        enabled: m.enabled,
        use_for_competitors: m.useForCompetitors,
        use_for_voice: m.useForVoice,
        use_for_answers: m.useForAnswers,
        use_for_reports: m.useForReports,
      }));
      const res = await fetch('/api/ai-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setAiModelsMessage({ type: 'success', text: 'AI model settings saved' });
      setTimeout(() => setAiModelsMessage(null), 3000);
    } catch (err) {
      setAiModelsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setAiModelsSaving(false);
    }
  };

  const handleRefreshModels = async () => {
    setRefreshingModels(true);
    try {
      const res = await fetch('/api/ai-models/refresh', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Refresh failed');
      }
      setAiModelsMessage({ type: 'success', text: 'AI models refreshed' });
      setTimeout(() => setAiModelsMessage(null), 3000);
    } catch (err) {
      setAiModelsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Refresh failed' });
    } finally {
      setRefreshingModels(false);
    }
  };

  const fetchFtpConnections = useCallback(async () => {
    if (!workspaceId) return;
    setFtpLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from('ftp_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setFtpConnections(data || []);
    } catch (err) {
      setFtpMessage({ type: 'error', text: 'Failed to load FTP connections' });
    } finally {
      setFtpLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (activeTab === 'ftp' && ftpConnections.length === 0 && !ftpLoading) {
      fetchFtpConnections();
    }
  }, [activeTab, ftpConnections.length, ftpLoading, fetchFtpConnections]);

  const handleFtpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFtpForm((prev) => ({ ...prev, [name]: value }));
    setFtpMessage(null);
  };

  const handleFtpTest = async () => {
    setFtpTesting(true);
    setFtpMessage(null);
    try {
      const res = await fetch('/api/ftp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: ftpForm.protocol,
          host: ftpForm.host,
          port: parseInt(ftpForm.port, 10),
          username: ftpForm.username,
          password: ftpForm.password,
          remote_path: ftpForm.remote_path,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection test failed');
      setFtpMessage({ type: 'success', text: 'Connection successful' });
      setTimeout(() => setFtpMessage(null), 3000);
    } catch (err) {
      setFtpMessage({ type: 'error', text: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setFtpTesting(false);
    }
  };

  const handleFtpSave = async () => {
    if (!ftpForm.host || !ftpForm.username) {
      setFtpMessage({ type: 'error', text: 'Host and username are required' });
      return;
    }
    setFtpSaving(true);
    setFtpMessage(null);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.from('ftp_connections').insert({
        workspace_id: workspaceId,
        user_id: user!.id,
        label: ftpForm.label || `${ftpForm.host}`,
        protocol: ftpForm.protocol,
        host: ftpForm.host,
        port: parseInt(ftpForm.port, 10),
        username: ftpForm.username,
        password: ftpForm.password,
        remote_path: ftpForm.remote_path,
      } as any);
      if (error) throw error;
      setFtpMessage({ type: 'success', text: 'FTP connection saved' });
      setFtpForm({ label: '', protocol: 'sftp', host: '', port: '22', username: '', password: '', remote_path: '/' });
      fetchFtpConnections();
      setTimeout(() => setFtpMessage(null), 3000);
    } catch (err) {
      setFtpMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setFtpSaving(false);
    }
  };

  const handleFtpDelete = async (id: string) => {
    try {
      const supabase = createBrowserSupabase();
      await supabase.from('ftp_connections').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
      setFtpConnections((prev) => prev.filter((c) => c.id !== id));
      setFtpMessage({ type: 'success', text: 'Connection removed' });
      setTimeout(() => setFtpMessage(null), 3000);
    } catch {
      setFtpMessage({ type: 'error', text: 'Failed to remove connection' });
    }
  };

  // Initialize form with profile data
  useEffect(() => {
    if (profile && !userLoading) {
      setFormState((prev) => ({
        ...prev,
        profile: {
          full_name: profile.full_name || '',
          company: profile.company || '',
        },
        billing: {
          company_name: profile.billing_company_name || '',
          vat_number: profile.billing_vat_number || '',
          address_line1: profile.billing_address_line1 || '',
          address_line2: profile.billing_address_line2 || '',
          city: profile.billing_city || '',
          postal_code: profile.billing_postal_code || '',
          country: profile.billing_country || '',
        },
      }));
    }
  }, [profile, userLoading]);

  if (userLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-off rounded animate-pulse" />
        <DashCard className="h-96 bg-off animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Please sign in to manage settings</p>
        <a href="/login" className="inline-flex items-center gap-2 font-medium text-[15px] px-6 py-3 min-h-[48px] rounded-full transition-all hover:brightness-110" style={{ background: 'var(--signal)', color: '#FFFFFF' }}>
          Sign In
        </a>
      </div>
    );
  }

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      profile: { ...prev.profile, [name]: value },
    }));
    setProfileChanged(true);
    setMessages((prev) => {
      const m = { ...prev };
      delete m.profileSuccess;
      delete m.profileError;
      return m;
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      password: { ...prev.password, [name]: value },
    }));
    setMessages((prev) => {
      const m = { ...prev };
      delete m.passwordSuccess;
      delete m.passwordError;
      return m;
    });
  };

  const handleBillingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      billing: { ...prev.billing, [name]: value },
    }));
    setBillingChanged(true);
    setMessages((prev) => {
      const m = { ...prev };
      delete m.billingSuccess;
      delete m.billingError;
      return m;
    });
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileChanged) {
      setMessages((prev) => ({ ...prev, profileError: 'No changes to save' }));
      return;
    }
    setLoadingProfile(true);
    setMessages((prev) => { const m = { ...prev }; delete m.profileSuccess; delete m.profileError; return m; });
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formState.profile.full_name || null,
          company: formState.profile.company || null,
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setProfileChanged(false);
      setMessages((prev) => ({ ...prev, profileSuccess: 'Profile updated successfully' }));
      setTimeout(() => setMessages((prev) => { const m = { ...prev }; delete m.profileSuccess; return m; }), 3000);
    } catch (err) {
      setMessages((prev) => ({
        ...prev,
        profileError: err instanceof Error ? err.message : 'Failed to update profile',
      }));
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleBillingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!billingChanged) {
      setMessages((prev) => ({ ...prev, billingError: 'No changes to save' }));
      return;
    }
    setLoadingBilling(true);
    setMessages((prev) => { const m = { ...prev }; delete m.billingSuccess; delete m.billingError; return m; });
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase
        .from('profiles')
        .update({
          billing_company_name: formState.billing.company_name || null,
          billing_vat_number: formState.billing.vat_number || null,
          billing_address_line1: formState.billing.address_line1 || null,
          billing_address_line2: formState.billing.address_line2 || null,
          billing_city: formState.billing.city || null,
          billing_postal_code: formState.billing.postal_code || null,
          billing_country: formState.billing.country || null,
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setBillingChanged(false);
      setMessages((prev) => ({ ...prev, billingSuccess: 'Billing information saved' }));
      setTimeout(() => setMessages((prev) => { const m = { ...prev }; delete m.billingSuccess; return m; }), 3000);
    } catch (err) {
      setMessages((prev) => ({
        ...prev,
        billingError: err instanceof Error ? err.message : 'Failed to save billing info',
      }));
    } finally {
      setLoadingBilling(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { newPassword, confirmPassword } = formState.password;
    if (!newPassword || !confirmPassword) {
      setMessages((prev) => ({ ...prev, passwordError: 'Both password fields are required' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessages((prev) => ({ ...prev, passwordError: 'Passwords do not match' }));
      return;
    }
    if (newPassword.length < 8) {
      setMessages((prev) => ({ ...prev, passwordError: 'Password must be at least 8 characters long' }));
      return;
    }
    setLoadingPassword(true);
    setMessages((prev) => { const m = { ...prev }; delete m.passwordSuccess; delete m.passwordError; return m; });
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setFormState((prev) => ({ ...prev, password: { newPassword: '', confirmPassword: '' } }));
      setMessages((prev) => ({ ...prev, passwordSuccess: 'Password updated successfully' }));
      setTimeout(() => setMessages((prev) => { const m = { ...prev }; delete m.passwordSuccess; return m; }), 3000);
    } catch (err) {
      setMessages((prev) => ({
        ...prev,
        passwordError: err instanceof Error ? err.message : 'Failed to update password',
      }));
    } finally {
      setLoadingPassword(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 border border-border rounded-xl font-sans text-sm transition-all focus:outline-none focus:border-text focus:shadow-[0_0_0_3px_rgba(0,0,0,.04)] bg-input-bg text-text placeholder:text-placeholder";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6">
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      {/* Header */}
      <PageHeader
        icon={<SettingsIcon size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-8" style={{ background: 'var(--paper-2)' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex-1 justify-center"
              style={{
                color: isActive ? 'var(--ink)' : 'var(--m-muted)',
                background: isActive ? 'var(--card)' : 'transparent',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ PROFILE TAB ═══ */}
      {activeTab === 'profile' && (
        <DashCard>
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-normal font-sans text-text">Profile Information</h2>
              <p className="text-sm text-muted mt-1">Update your profile details</p>
            </div>

            {messages.profileSuccess && (
              <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--ok) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}>
                <p className="text-sm" style={{ color: 'var(--ok)' }}>{messages.profileSuccess}</p>
              </div>
            )}
            {messages.profileError && (
              <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
                <p className="text-sm" style={{ color: 'var(--severe)' }}>{messages.profileError}</p>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text mb-1.5">Email Address</label>
                <input
                  type="email"
                  id="email"
                  value={user.email || ''}
                  disabled
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-off text-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted mt-1">Email cannot be changed. Contact support for assistance.</p>
              </div>

              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-text mb-1.5">Full Name</label>
                <input type="text" id="full_name" name="full_name" value={formState.profile.full_name} onChange={handleProfileChange} placeholder="Your full name" className={inputClass} />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-text mb-1.5">Company</label>
                <input type="text" id="company" name="company" value={formState.profile.company} onChange={handleProfileChange} placeholder="Your company name" className={inputClass} />
              </div>

              <Button variant="primary" size="md" loading={loadingProfile} disabled={loadingProfile || !profileChanged} type="submit">
                Save Changes
              </Button>
            </form>
          </div>
        </DashCard>
      )}

      {/* ═══ COMPANY & BILLING TAB ═══ */}
      {activeTab === 'company' && (
        <DashCard>
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={18} style={{ color: 'var(--ink)' }} />
                <h2 className="text-lg font-normal font-sans text-text">Company & Billing</h2>
              </div>
              <p className="text-sm text-muted">Optional — add company details for invoices and receipts</p>
            </div>

            {messages.billingSuccess && (
              <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--ok) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}>
                <p className="text-sm" style={{ color: 'var(--ok)' }}>{messages.billingSuccess}</p>
              </div>
            )}
            {messages.billingError && (
              <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
                <p className="text-sm" style={{ color: 'var(--severe)' }}>{messages.billingError}</p>
              </div>
            )}

            <form onSubmit={handleBillingSubmit} className="space-y-4">
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-text mb-1.5">Company Name</label>
                <input type="text" id="company_name" name="company_name" value={formState.billing.company_name} onChange={handleBillingChange} placeholder="Acme Inc." className={inputClass} />
              </div>

              <div>
                <label htmlFor="vat_number" className="block text-sm font-medium text-text mb-1.5">VAT / Tax Number</label>
                <input type="text" id="vat_number" name="vat_number" value={formState.billing.vat_number} onChange={handleBillingChange} placeholder="e.g. GB123456789" className={inputClass} />
              </div>

              <div>
                <label htmlFor="address_line1" className="block text-sm font-medium text-text mb-1.5">Address Line 1</label>
                <input type="text" id="address_line1" name="address_line1" value={formState.billing.address_line1} onChange={handleBillingChange} placeholder="123 Business Street" className={inputClass} />
              </div>

              <div>
                <label htmlFor="address_line2" className="block text-sm font-medium text-text mb-1.5">Address Line 2</label>
                <input type="text" id="address_line2" name="address_line2" value={formState.billing.address_line2} onChange={handleBillingChange} placeholder="Suite 100 (optional)" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-text mb-1.5">City</label>
                  <input type="text" id="city" name="city" value={formState.billing.city} onChange={handleBillingChange} placeholder="London" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium text-text mb-1.5">Postal Code</label>
                  <input type="text" id="postal_code" name="postal_code" value={formState.billing.postal_code} onChange={handleBillingChange} placeholder="SW1A 1AA" className={inputClass} />
                </div>
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-text mb-1.5">Country</label>
                <input type="text" id="country" name="country" value={formState.billing.country} onChange={handleBillingChange} placeholder="United Kingdom" className={inputClass} />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button variant="primary" size="md" loading={loadingBilling} disabled={loadingBilling || !billingChanged} type="submit">
                  Save Billing Info
                </Button>
                <p className="text-xs text-muted">This information will appear on your invoices.</p>
              </div>
            </form>

            {/* Stripe portal link */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
                  <CreditCard size={18} style={{ color: 'var(--ink)' }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text mb-0.5">Payment History</p>
                  <p className="text-xs text-muted mb-2">View receipts and manage payment methods through Stripe.</p>
                  <a
                    href="/api/stripe/portal"
                    className="text-xs font-medium text-text hover:underline"
                  >
                    Open Stripe Portal &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>
        </DashCard>
      )}

      {/* ═══ AI MODELS TAB ═══ */}
      {activeTab === 'ai_models' && (
        <div className="space-y-6">
          <DashCard>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu size={18} style={{ color: 'var(--ink)' }} />
                    <h2 className="text-lg font-normal font-sans text-text">AI Models</h2>
                  </div>
                  <p className="text-sm text-muted">Configure which AI search engines are used in your audits — AI perception, brand intelligence, competitors, and benchmarking.</p>
                </div>
                <button
                  onClick={handleRefreshModels}
                  disabled={refreshingModels}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:bg-black/[0.04]"
                  style={{ color: 'var(--ink-2)', border: '1px solid var(--rule)' }}
                >
                  <RefreshCw size={12} className={refreshingModels ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {aiModelsMessage && (
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: aiModelsMessage.type === 'success'
                      ? 'color-mix(in srgb, var(--ok) 8%, transparent)'
                      : 'color-mix(in srgb, var(--severe) 8%, transparent)',
                    border: `1px solid ${aiModelsMessage.type === 'success'
                      ? 'color-mix(in srgb, var(--ok) 20%, transparent)'
                      : 'color-mix(in srgb, var(--severe) 20%, transparent)'}`,
                  }}
                >
                  <p className="text-sm" style={{ color: aiModelsMessage.type === 'success' ? 'var(--ok)' : 'var(--severe)' }}>
                    {aiModelsMessage.text}
                  </p>
                </div>
              )}

              {aiModelsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Claude — always enabled */}
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {(() => {
                        const iconKey = providerKeyToIcon('claude');
                        return iconKey ? <AIProviderIcon provider={iconKey} size={20} /> : null;
                      })()}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text">Claude</p>
                        <p className="text-xs text-muted">Anthropic — Direct SDK (always enabled, uses prompt caching)</p>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--ok) 12%, transparent)', color: 'var(--ok)' }}>
                        Always On
                      </span>
                    </div>
                  </div>

                  {/* Dynamic models */}
                  {aiModels.map((model) => {
                    const iconKey = providerKeyToIcon(model.shortId);
                    const allDisabled = aiModels.every((m) => !m.enabled);
                    return (
                      <div
                        key={model.slug}
                        className="rounded-xl p-4 transition-all"
                        style={{
                          background: model.enabled ? 'var(--card)' : 'var(--paper-2)',
                          border: `1px solid ${model.enabled ? 'var(--rule)' : 'color-mix(in srgb, var(--rule) 50%, transparent)'}`,
                          opacity: model.enabled ? 1 : 0.7,
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          {iconKey ? <AIProviderIcon provider={iconKey} size={20} /> : (
                            <div className="w-5 h-5 rounded-full" style={{ background: 'var(--rule)' }} />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-text">{model.displayName}</p>
                            <p className="text-xs text-muted">{model.productName || model.provider}</p>
                          </div>
                          {/* Master toggle */}
                          <button
                            onClick={() => handleAIModelToggle(model.slug, 'enabled')}
                            className="relative w-10 h-[22px] rounded-full transition-colors"
                            style={{ background: model.enabled ? 'var(--signal)' : 'var(--rule)' }}
                            aria-label={`${model.enabled ? 'Disable' : 'Enable'} ${model.displayName}`}
                          >
                            <span
                              className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform"
                              style={{ left: model.enabled ? '20px' : '2px' }}
                            />
                          </button>
                        </div>

                        {model.enabled && (
                          <div className="flex gap-3 flex-wrap">
                            {([
                              { key: 'useForCompetitors' as const, label: 'Competitors' },
                              { key: 'useForVoice' as const, label: 'AI Perception' },
                              { key: 'useForAnswers' as const, label: 'Brand Intelligence' },
                              { key: 'useForReports' as const, label: 'Reports' },
                            ]).map(({ key, label }) => (
                              <button
                                key={key}
                                onClick={() => handleAIModelToggle(model.slug, key)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all"
                                style={{
                                  background: model[key] ? 'color-mix(in srgb, var(--signal) 10%, transparent)' : 'transparent',
                                  border: `1px solid ${model[key] ? 'color-mix(in srgb, var(--signal) 30%, transparent)' : 'var(--rule)'}`,
                                  color: model[key] ? 'var(--ink)' : 'var(--m-muted)',
                                }}
                              >
                                <span className="w-2 h-2 rounded-full" style={{ background: model[key] ? 'var(--signal)' : 'var(--rule)' }} />
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {allDisabled && model === aiModels[0] && (
                          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--warn) 8%, transparent)' }}>
                            <AlertTriangle size={14} style={{ color: 'var(--warn)' }} />
                            <p className="text-xs" style={{ color: 'var(--warn)' }}>
                              All external models are disabled. Only Claude will be used for benchmarking.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <Button
                    variant="primary"
                    size="md"
                    loading={aiModelsSaving}
                    disabled={aiModelsSaving}
                    onClick={saveAIModelSettings}
                  >
                    Save Model Settings
                  </Button>
                </>
              )}
            </div>
          </DashCard>
        </div>
      )}

      {/* ═══ SECURITY TAB ═══ */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <DashCard>
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-normal font-sans text-text">Change Password</h2>
                <p className="text-sm text-muted mt-1">Update your account password</p>
              </div>

              {messages.passwordSuccess && (
                <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--ok) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}>
                  <p className="text-sm" style={{ color: 'var(--ok)' }}>{messages.passwordSuccess}</p>
                </div>
              )}
              {messages.passwordError && (
                <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
                  <p className="text-sm" style={{ color: 'var(--severe)' }}>{messages.passwordError}</p>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-text mb-1.5">New Password</label>
                  <input type="password" id="newPassword" name="newPassword" value={formState.password.newPassword} onChange={handlePasswordChange} placeholder="At least 8 characters" className={inputClass} />
                  <p className="text-xs text-muted mt-1">Must be at least 8 characters long</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-text mb-1.5">Confirm Password</label>
                  <input type="password" id="confirmPassword" name="confirmPassword" value={formState.password.confirmPassword} onChange={handlePasswordChange} placeholder="Re-enter your password" className={inputClass} />
                </div>

                <Button variant="primary" size="md" loading={loadingPassword} disabled={loadingPassword} type="submit">
                  Update Password
                </Button>
              </form>
            </div>
          </DashCard>

          {/* Danger Zone */}
          <DashCard>
            <div className="space-y-4" style={{ borderTop: '2px solid var(--severe)', marginTop: '-1px', paddingTop: '20px' }}>
              <h2 className="text-lg font-medium" style={{ color: 'var(--severe)' }}>Danger zone</h2>
              <p className="text-sm" style={{ color: 'var(--m-muted)' }}>
                Once you delete your account, there is no going back. All your audits, reports, and data will be permanently removed.
              </p>

              {deleteError && (
                <div className="p-3 rounded-md" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
                  <p className="text-xs" style={{ color: 'var(--severe)' }}>{deleteError}</p>
                </div>
              )}

              <div className="pt-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--severe)' }}>
                  Type <span className="font-medium">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full max-w-[200px] px-3 py-2 text-sm rounded-md focus:outline-none"
                  style={{ border: '1px solid var(--rule)', background: 'var(--card)', color: 'var(--ink)' }}
                />
              </div>

              <Button
                variant="danger"
                size="md"
                disabled={deleteConfirm !== 'DELETE' || deletingAccount}
                onClick={async () => {
                  if (deleteConfirm !== 'DELETE') return;
                  setDeletingAccount(true);
                  setDeleteError(null);
                  try {
                    const res = await fetch('/api/account/delete', { method: 'DELETE' });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Deletion failed');
                    window.location.replace('/');
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
                    setDeletingAccount(false);
                  }
                }}
              >
                {deletingAccount ? 'Deleting...' : 'Permanently Delete Account'}
              </Button>
            </div>
          </DashCard>
        </div>
      )}

      {/* ═══ FTP / SFTP TAB ═══ */}
      {activeTab === 'ftp' && (
        <div className="space-y-6">
          {/* Existing connections */}
          {ftpConnections.length > 0 && (
            <DashCard>
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-normal font-sans text-text">Saved Connections</h2>
                  <p className="text-sm text-muted mt-1">Your workspace FTP/SFTP connections</p>
                </div>
                {ftpConnections.map((conn: any) => (
                  <div key={conn.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                    <HardDrive size={16} style={{ color: 'var(--ink)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{conn.label || conn.host}</p>
                      <p className="text-xs text-muted">{conn.protocol?.toUpperCase()} — {conn.host}:{conn.port} — {conn.remote_path}</p>
                    </div>
                    <button
                      onClick={() => handleFtpDelete(conn.id)}
                      className="text-xs px-2 py-1 rounded-md transition-all hover:bg-black/[0.04]"
                      style={{ color: 'var(--severe)' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </DashCard>
          )}

          {/* Add new connection */}
          <DashCard>
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive size={18} style={{ color: 'var(--ink)' }} />
                  <h2 className="text-lg font-normal font-sans text-text">
                    {ftpConnections.length > 0 ? 'Add Connection' : 'FTP / SFTP Connection'}
                  </h2>
                </div>
                <p className="text-sm text-muted">Connect your server to deploy fixes directly from Fixpath</p>
              </div>

              {ftpMessage && (
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: ftpMessage.type === 'success'
                      ? 'color-mix(in srgb, var(--ok) 8%, transparent)'
                      : 'color-mix(in srgb, var(--severe) 8%, transparent)',
                    border: `1px solid ${ftpMessage.type === 'success'
                      ? 'color-mix(in srgb, var(--ok) 20%, transparent)'
                      : 'color-mix(in srgb, var(--severe) 20%, transparent)'}`,
                  }}
                >
                  <p className="text-sm" style={{ color: ftpMessage.type === 'success' ? 'var(--ok)' : 'var(--severe)' }}>
                    {ftpMessage.text}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="ftp-label" className="block text-sm font-medium text-text mb-1.5">Connection Label</label>
                  <input type="text" id="ftp-label" name="label" value={ftpForm.label} onChange={handleFtpChange} placeholder="e.g. Production Server" className={inputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ftp-protocol" className="block text-sm font-medium text-text mb-1.5">Protocol</label>
                    <select id="ftp-protocol" name="protocol" value={ftpForm.protocol} onChange={handleFtpChange as any} className={inputClass}>
                      <option value="sftp">SFTP (recommended)</option>
                      <option value="ftp">FTP</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ftp-port" className="block text-sm font-medium text-text mb-1.5">Port</label>
                    <input type="text" id="ftp-port" name="port" value={ftpForm.port} onChange={handleFtpChange} placeholder="22" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label htmlFor="ftp-host" className="block text-sm font-medium text-text mb-1.5">Host</label>
                  <input type="text" id="ftp-host" name="host" value={ftpForm.host} onChange={handleFtpChange} placeholder="ftp.example.com" className={inputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ftp-username" className="block text-sm font-medium text-text mb-1.5">Username</label>
                    <input type="text" id="ftp-username" name="username" value={ftpForm.username} onChange={handleFtpChange} placeholder="deploy_user" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="ftp-password" className="block text-sm font-medium text-text mb-1.5">Password</label>
                    <input type="password" id="ftp-password" name="password" value={ftpForm.password} onChange={handleFtpChange} placeholder="••••••••" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label htmlFor="ftp-path" className="block text-sm font-medium text-text mb-1.5">Remote Path</label>
                  <input type="text" id="ftp-path" name="remote_path" value={ftpForm.remote_path} onChange={handleFtpChange} placeholder="/var/www/html" className={inputClass} />
                  <p className="text-xs text-muted mt-1">The root directory on your server where site files live</p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button variant="primary" size="md" loading={ftpSaving} disabled={ftpSaving || !ftpForm.host || !ftpForm.username} onClick={handleFtpSave}>
                    Save Connection
                  </Button>
                  <button
                    onClick={handleFtpTest}
                    disabled={ftpTesting || !ftpForm.host || !ftpForm.username}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl transition-all hover:bg-black/[0.04] disabled:opacity-50"
                    style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
                  >
                    {ftpTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            </div>
          </DashCard>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
