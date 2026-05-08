'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Paintbrush,
  Upload,
  X,
  Check,
  Lock,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface WhiteLabelFormData {
  company_name: string;
  brand_color: string;
  contact_email: string;
  footer_text: string;
  is_active: boolean;
}

const DEFAULT_COLOR = '#84CC16';

const WhiteLabelPage: React.FC = () => {
  const { user, loading: userLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [canEdit, setCanEdit] = useState(false);
  const [packageTier, setPackageTier] = useState('starter');
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [form, setForm] = useState<WhiteLabelFormData>({
    company_name: '',
    brand_color: DEFAULT_COLOR,
    contact_email: '',
    footer_text: '',
    is_active: true,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await fetch('/api/white-label');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setCanEdit(data.can_edit);
        setPackageTier(data.package_tier);
        if (data.settings) {
          setForm({
            company_name: data.settings.company_name || '',
            brand_color: data.settings.brand_color || DEFAULT_COLOR,
            contact_email: data.settings.contact_email || '',
            footer_text: data.settings.footer_text || '',
            is_active: data.settings.is_active ?? true,
          });
          setLogoUrl(data.settings.logo_url || null);
        }
      } catch {
        setErrorMsg('Failed to load white-label settings');
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setHasChanges(true);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate type
    if (!['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMsg('Logo must be PNG, SVG, JPEG, or WebP');
      return;
    }
    // Validate size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Logo must be under 2MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setHasChanges(true);
    setErrorMsg(null);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl(null);
    setHasChanges(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !user) return;

    // Validate color
    if (form.brand_color && !/^#[0-9A-Fa-f]{6}$/.test(form.brand_color)) {
      setErrorMsg('Brand color must be a valid hex (e.g. #84CC16)');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let finalLogoUrl = logoUrl;

      // Upload new logo if selected
      if (logoFile) {
        setLogoUploading(true);
        const supabase = createBrowserSupabase();
        const ext = logoFile.name.split('.').pop() || 'png';
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('white-label-logos')
          .upload(filePath, logoFile, { cacheControl: '31536000', upsert: false });
        setLogoUploading(false);
        if (uploadErr) throw new Error('Failed to upload logo');
        const { data: urlData } = supabase.storage
          .from('white-label-logos')
          .getPublicUrl(filePath);
        finalLogoUrl = urlData.publicUrl;
      }

      const res = await fetch('/api/white-label', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          logo_url: finalLogoUrl,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save');
      }

      const data = await res.json();
      setLogoUrl(data.settings?.logo_url || finalLogoUrl);
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setHasChanges(false);
      setSuccessMsg('White-label settings saved');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
      setLogoUploading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-border rounded-xl font-body text-sm transition-all focus:outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,.08)] bg-input-bg text-text placeholder:text-placeholder';

  if (userLoading || dataLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-off rounded animate-pulse" />
        <div className="h-96 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Please sign in to access white-label settings</p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 bg-brand text-surface dark:text-[#111111] font-medium text-[15px] px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110"
        >
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Paintbrush size={22} className="text-brand" />
          <h1 className="text-2xl font-medium font-heading text-text">White Label</h1>
        </div>
        <p className="text-muted text-sm mt-1 pl-[34px]">
          Customize reports with your own branding. Settings apply to all future audits.
        </p>
      </div>

      {/* Upgrade prompt for non-eligible users */}
      {!canEdit && (
        <Card className="mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
              <Lock size={18} className="text-brand" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-medium text-text mb-1">
                Upgrade to unlock white-label reports
              </h2>
              <p className="text-sm text-muted mb-4">
                White-label branding is available on Growth, Agency, and Scale plans. Replace ClearUX branding with your own company name, logo, and colors in all generated reports.
              </p>
              <Link
                href="/dashboard/buy-credits"
                className="inline-flex items-center gap-2 text-sm font-medium text-text border border-border rounded-lg px-4 py-2 hover:bg-surface transition-colors"
              >
                <Sparkles size={14} />
                View Plans
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Settings form */}
      <Card className={!canEdit ? 'opacity-60 pointer-events-none select-none' : ''}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Status messages */}
          {successMsg && (
            <div className="flex items-center gap-2 bg-[#22C55E]/5 dark:bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg p-3">
              <Check size={14} className="text-[#22C55E] flex-shrink-0" />
              <p className="text-[#22C55E] text-sm">{successMsg}</p>
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-700 dark:text-red-300 text-sm">{errorMsg}</p>
            </div>
          )}

          {/* Company Name */}
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-text mb-1.5">
              Company Name
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder="Your Company Name"
              className={inputClass}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted mt-1">
              Displayed in the report header and footer
            </p>
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Company Logo</label>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="w-20 h-20 rounded-xl border border-border bg-off flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview || logoUrl ? (
                  <img
                    src={logoPreview || logoUrl || ''}
                    alt="Logo preview"
                    className="w-full h-full object-contain p-1.5"
                  />
                ) : (
                  <ImageIcon size={24} className="text-muted/40" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canEdit}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors disabled:opacity-50"
                  >
                    <Upload size={13} />
                    {logoUrl || logoPreview ? 'Replace' : 'Upload'}
                  </button>
                  {(logoUrl || logoPreview) && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="inline-flex items-center gap-1 text-sm text-muted hover:text-red-500 transition-colors"
                    >
                      <X size={13} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted">PNG, SVG, JPEG, or WebP. Max 2MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.svg,.jpg,.jpeg,.webp,image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Brand Color */}
          <div>
            <label htmlFor="brand_color" className="block text-sm font-medium text-text mb-1.5">
              Brand Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="brand_color_picker"
                value={form.brand_color || DEFAULT_COLOR}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, brand_color: e.target.value }));
                  setHasChanges(true);
                  setSuccessMsg(null);
                }}
                disabled={!canEdit}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5 disabled:opacity-50"
              />
              <input
                type="text"
                id="brand_color"
                name="brand_color"
                value={form.brand_color}
                onChange={handleChange}
                placeholder="#84CC16"
                className={`${inputClass} max-w-[140px] font-mono`}
                disabled={!canEdit}
                maxLength={7}
              />
              <div
                className="h-10 flex-1 rounded-lg border border-border"
                style={{ background: form.brand_color || DEFAULT_COLOR }}
              />
            </div>
            <p className="text-xs text-muted mt-1">
              Used for headings and accents in PDF/DOCX reports
            </p>
          </div>

          {/* Contact Email */}
          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-text mb-1.5">
              Contact Email
            </label>
            <input
              type="email"
              id="contact_email"
              name="contact_email"
              value={form.contact_email}
              onChange={handleChange}
              placeholder="reports@yourcompany.com"
              className={inputClass}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted mt-1">
              Shown in the report footer as the point of contact
            </p>
          </div>

          {/* Footer Text */}
          <div>
            <label htmlFor="footer_text" className="block text-sm font-medium text-text mb-1.5">
              Custom Footer Text
            </label>
            <textarea
              id="footer_text"
              name="footer_text"
              value={form.footer_text}
              onChange={handleChange}
              placeholder="Confidential — prepared by Your Company"
              rows={2}
              className={`${inputClass} resize-none`}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted mt-1">
              Replaces the default ClearUX footer in reports
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <p className="text-sm font-medium text-text">Enable white-label</p>
              <p className="text-xs text-muted mt-0.5">
                When disabled, reports use default ClearUX branding
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
                disabled={!canEdit}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-off rounded-full peer peer-checked:bg-brand transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              loading={saving || logoUploading}
              disabled={!canEdit || saving || logoUploading || !hasChanges}
              type="submit"
            >
              {logoUploading ? 'Uploading logo...' : saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Preview section */}
      {canEdit && (form.company_name || logoUrl || logoPreview) && (
        <Card className="mt-6">
          <h3 className="text-sm font-medium text-text mb-3">Report Preview</h3>
          <div className="rounded-lg border border-border bg-white p-6 space-y-3">
            <div className="flex items-center gap-3">
              {(logoPreview || logoUrl) && (
                <img
                  src={logoPreview || logoUrl || ''}
                  alt="Logo"
                  className="h-8 object-contain"
                />
              )}
              {form.company_name && (
                <span
                  className="text-lg font-semibold"
                  style={{ color: form.brand_color || DEFAULT_COLOR }}
                >
                  {form.company_name}
                </span>
              )}
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{form.footer_text || 'Custom footer text appears here'}</span>
              <span>{form.contact_email || 'contact@email.com'}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default WhiteLabelPage;
