'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
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

interface FormState {
  profile: ProfileFormData;
  password: PasswordFormData;
}

interface Messages {
  profileSuccess?: string;
  profileError?: string;
  passwordSuccess?: string;
  passwordError?: string;
}

const SettingsPage: React.FC = () => {
  const { user, profile, loading: userLoading, refreshProfile } = useUser();
  const [formState, setFormState] = useState<FormState>({
    profile: {
      full_name: '',
      company: '',
    },
    password: {
      newPassword: '',
      confirmPassword: '',
    },
  });
  const [messages, setMessages] = useState<Messages>({});
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [profileChanged, setProfileChanged] = useState(false);

  // Initialize form with profile data
  useEffect(() => {
    if (profile && !userLoading) {
      setFormState((prev) => ({
        ...prev,
        profile: {
          full_name: profile.full_name || '',
          company: profile.company || '',
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
      <div className="text-center py-12">
        <p className="text-muted mb-4">Please sign in to manage settings</p>
        <Link href="/login">
          <Button variant="primary">Sign In</Button>
        </Link>
      </div>
    );
  }

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [name]: value,
      },
    }));
    setProfileChanged(true);
    setMessages((prev) => {
      const newMessages = { ...prev };
      delete newMessages.profileSuccess;
      delete newMessages.profileError;
      return newMessages;
    });
  };

  const handlePasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      password: {
        ...prev.password,
        [name]: value,
      },
    }));
    setMessages((prev) => {
      const newMessages = { ...prev };
      delete newMessages.passwordSuccess;
      delete newMessages.passwordError;
      return newMessages;
    });
  };

  const handleProfileSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!profileChanged) {
      setMessages((prev) => ({
        ...prev,
        profileError: 'No changes to save',
      }));
      return;
    }

    setLoadingProfile(true);
    setMessages((prev) => {
      const newMessages = { ...prev };
      delete newMessages.profileSuccess;
      delete newMessages.profileError;
      return newMessages;
    });

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
      setMessages((prev) => ({
        ...prev,
        profileSuccess: 'Profile updated successfully',
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages.profileSuccess;
          return newMessages;
        });
      }, 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessages((prev) => ({
        ...prev,
        profileError:
          err instanceof Error ? err.message : 'Failed to update profile',
      }));
    } finally {
      setLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const { newPassword, confirmPassword } = formState.password;

    if (!newPassword || !confirmPassword) {
      setMessages((prev) => ({
        ...prev,
        passwordError: 'Both password fields are required',
      }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessages((prev) => ({
        ...prev,
        passwordError: 'Passwords do not match',
      }));
      return;
    }

    if (newPassword.length < 8) {
      setMessages((prev) => ({
        ...prev,
        passwordError: 'Password must be at least 8 characters long',
      }));
      return;
    }

    setLoadingPassword(true);
    setMessages((prev) => {
      const newMessages = { ...prev };
      delete newMessages.passwordSuccess;
      delete newMessages.passwordError;
      return newMessages;
    });

    try {
      const supabase = createBrowserSupabase();

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setFormState((prev) => ({
        ...prev,
        password: {
          newPassword: '',
          confirmPassword: '',
        },
      }));

      setMessages((prev) => ({
        ...prev,
        passwordSuccess: 'Password updated successfully',
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages.passwordSuccess;
          return newMessages;
        });
      }, 3000);
    } catch (err) {
      console.error('Error updating password:', err);
      setMessages((prev) => ({
        ...prev,
        passwordError:
          err instanceof Error ? err.message : 'Failed to update password',
      }));
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Button>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-manrope text-text">Settings</h1>
        <p className="text-muted mt-2">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold font-manrope text-text">
              Profile Information
            </h2>
            <p className="text-sm text-muted mt-1">
              Update your profile details
            </p>
          </div>

          {messages.profileSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-300 text-sm">{messages.profileSuccess}</p>
            </div>
          )}

          {messages.profileError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-300 text-sm">{messages.profileError}</p>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={user.email || ''}
                disabled
                className="w-full px-4 py-2 border border-border rounded-lg font-inter text-base bg-off text-muted cursor-not-allowed bg-input-bg"
              />
              <p className="text-xs text-muted mt-1">
                Email cannot be changed. Contact support for assistance.
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-text mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formState.profile.full_name}
                onChange={handleProfileChange}
                placeholder="Your full name"
                className="w-full px-4 py-2 border border-border rounded-lg font-inter text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue/30 bg-input-bg text-text placeholder:text-placeholder"
              />
            </div>

            {/* Company */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-text mb-2">
                Company
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formState.profile.company}
                onChange={handleProfileChange}
                placeholder="Your company name"
                className="w-full px-4 py-2 border border-border rounded-lg font-inter text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue/30 bg-input-bg text-text placeholder:text-placeholder"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              loading={loadingProfile}
              disabled={loadingProfile || !profileChanged}
              type="submit"
            >
              Save Changes
            </Button>
          </form>
        </div>
      </Card>

      {/* Password Section */}
      <Card>
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <Lock size={24} className="text-blue mt-1" />
            <div>
              <h2 className="text-xl font-bold font-manrope text-text">
                Change Password
              </h2>
              <p className="text-sm text-muted mt-1">
                Update your account password
              </p>
            </div>
          </div>

          {messages.passwordSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-300 text-sm">{messages.passwordSuccess}</p>
            </div>
          )}

          {messages.passwordError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-300 text-sm">{messages.passwordError}</p>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-text mb-2">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formState.password.newPassword}
                onChange={handlePasswordChange}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2 border border-border rounded-lg font-inter text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue/30 bg-input-bg text-text placeholder:text-placeholder"
              />
              <p className="text-xs text-muted mt-1">
                Must be at least 8 characters long
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formState.password.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2 border border-border rounded-lg font-inter text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue/30 bg-input-bg text-text placeholder:text-placeholder"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              loading={loadingPassword}
              disabled={loadingPassword}
              type="submit"
            >
              Update Password
            </Button>
          </form>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-red-900 dark:text-red-300">Danger Zone</h2>
          <p className="text-sm text-red-800 dark:text-red-400 mb-2">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <a
            href="https://app.supabase.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="danger" size="md">
              Delete Account
            </Button>
          </a>
          <p className="text-xs text-red-700 dark:text-red-400 mt-2">
            To delete your account, please visit your Supabase account settings.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
