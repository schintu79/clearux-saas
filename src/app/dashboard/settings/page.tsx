'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, User, Building2, CreditCard, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

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

type TabId = 'profile' | 'company' | 'security';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company & Billing', icon: Building2 },
  { id: 'security', label: 'Security', icon: Lock },
];

const SettingsPage: React.FC = () => {
  const { user, profile, loading: userLoading, refreshProfile } = useAuth();
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
        <Card className="h-96 bg-off animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Please sign in to manage settings</p>
        <a href="/login" className="inline-flex items-center gap-2 bg-brand text-surface dark:text-[#111111] font-medium text-[15px] px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110">
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

  const inputClass = "w-full px-4 py-2.5 border border-border rounded-xl font-body text-sm transition-all focus:outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,.08)] bg-input-bg text-text placeholder:text-placeholder";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6">
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <SettingsIcon size={22} className="text-brand" />
          <h1 className="text-2xl font-medium font-heading text-text">Settings</h1>
        </div>
        <p className="text-muted text-sm mt-1 pl-[34px]">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-off mb-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                isActive
                  ? 'bg-card text-text shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ PROFILE TAB ═══ */}
      {activeTab === 'profile' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium font-heading text-text">Profile Information</h2>
              <p className="text-sm text-muted mt-1">Update your profile details</p>
            </div>

            {messages.profileSuccess && (
              <div className="bg-[#22C55E]/5 dark:bg-[#22C55E]/10 border border-[#22C55E]/20 dark:border-[#22C55E]/20 rounded-lg p-3">
                <p className="text-[#22C55E] text-sm">{messages.profileSuccess}</p>
              </div>
            )}
            {messages.profileError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-700 dark:text-red-300 text-sm">{messages.profileError}</p>
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
        </Card>
      )}

      {/* ═══ COMPANY & BILLING TAB ═══ */}
      {activeTab === 'company' && (
        <Card>
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={18} className="text-brand" />
                <h2 className="text-lg font-medium font-heading text-text">Company & Billing</h2>
              </div>
              <p className="text-sm text-muted">Optional — add company details for invoices and receipts</p>
            </div>

            {messages.billingSuccess && (
              <div className="bg-[#22C55E]/5 dark:bg-[#22C55E]/10 border border-[#22C55E]/20 dark:border-[#22C55E]/20 rounded-lg p-3">
                <p className="text-[#22C55E] text-sm">{messages.billingSuccess}</p>
              </div>
            )}
            {messages.billingError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-700 dark:text-red-300 text-sm">{messages.billingError}</p>
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
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CreditCard size={18} className="text-brand" />
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
        </Card>
      )}

      {/* ═══ SECURITY TAB ═══ */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium font-heading text-text">Change Password</h2>
                <p className="text-sm text-muted mt-1">Update your account password</p>
              </div>

              {messages.passwordSuccess && (
                <div className="bg-[#22C55E]/5 dark:bg-[#22C55E]/10 border border-[#22C55E]/20 dark:border-[#22C55E]/20 rounded-lg p-3">
                  <p className="text-[#22C55E] text-sm">{messages.passwordSuccess}</p>
                </div>
              )}
              {messages.passwordError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-700 dark:text-red-300 text-sm">{messages.passwordError}</p>
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
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-red-900 dark:text-red-300">Danger Zone</h2>
              <p className="text-sm text-red-800/80 dark:text-red-400/80">
                Once you delete your account, there is no going back. All your audits, reports, and data will be permanently removed.
              </p>

              {deleteError && (
                <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700">
                  <p className="text-xs text-red-700 dark:text-red-300">{deleteError}</p>
                </div>
              )}

              <div className="pt-1">
                <label className="block text-xs font-medium text-red-800 dark:text-red-400 mb-1.5">
                  Type <span className="font-medium">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full max-w-[200px] px-3 py-2 text-sm rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-red-900/30 text-text placeholder:text-red-300 dark:placeholder:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
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
          </Card>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
