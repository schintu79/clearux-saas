'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, CheckCircle, Zap, ArrowRight } from 'lucide-react';
import { useUser } from '@/hooks/useUser';

const PACKS = [
  { id: 'starter', credits: 1, price: 29, per: '$29.00', save: null, popular: false },
  { id: 'growth', credits: 5, price: 99, per: '$19.80', save: '32%', popular: true },
  { id: 'agency', credits: 15, price: 249, per: '$16.60', save: '43%', popular: false },
  { id: 'scale', credits: 50, price: 599, per: '$11.98', save: '59%', popular: false },
] as const;

export default function BuyCreditsPage() {
  const { user, loading: userLoading } = useUser();
  const [credits, setCredits] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => setCredits(d.credits ?? 0))
      .catch(() => setCredits(0));
  }, [user]);

  const handlePurchase = async (packId: string) => {
    setPurchasing(packId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to create checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      console.error('Purchase error:', err);
      setPurchasing(null);
      alert('Something went wrong. Please try again.');
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Coins size={28} className="text-accent" />
        </div>
        <h1 className="text-3xl font-bold font-manrope text-text mb-2">
          Buy Audit Credits
        </h1>
        <p className="text-muted max-w-md mx-auto">
          Every credit = one full deep audit across all 48 checkpoints. Buy more, save more.
        </p>
        {credits !== null && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
            <Coins size={14} className="text-accent" />
            <span className="text-sm font-semibold text-text">
              Current balance: <span className="text-accent">{credits} credit{credits !== 1 ? 's' : ''}</span>
            </span>
          </div>
        )}
      </div>

      {/* Pack grid */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`relative rounded-2xl p-6 transition-all duration-200 ${
              pack.popular
                ? 'bg-card border-2 border-accent shadow-lg shadow-accent/10'
                : 'bg-card border border-border hover:shadow-lg hover:border-accent/30'
            }`}
          >
            {pack.popular && (
              <span className="absolute -top-2.5 right-4 bg-accent text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md">
                Customers Favourite
              </span>
            )}

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-manrope font-bold text-lg text-text">
                  {pack.credits} Credit{pack.credits !== 1 ? 's' : ''}
                </h3>
                <p className="text-xs text-muted">{pack.per} per audit</p>
              </div>
              {pack.save && (
                <span className="inline-flex items-center bg-accent/10 text-accent text-xs font-bold px-2.5 py-1 rounded-full">
                  Save {pack.save}
                </span>
              )}
            </div>

            <div className="mb-4">
              <span className="font-manrope text-3xl font-bold text-text">${pack.price}</span>
            </div>

            <div className="space-y-1.5 mb-5">
              {[
                `${pack.credits} full deep audit${pack.credits !== 1 ? 's' : ''}`,
                '48 checkpoints per audit',
                'PDF + DOCX reports',
                'Credits never expire',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle size={13} className="text-accent flex-shrink-0" />
                  <span className="text-xs text-muted">{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handlePurchase(pack.id)}
              disabled={purchasing !== null}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 ${
                pack.popular
                  ? 'bg-accent text-white hover:bg-accent-dk shadow-md shadow-accent/20'
                  : 'bg-off text-text hover:bg-accent/10 hover:text-accent border border-border'
              }`}
            >
              {purchasing === pack.id ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  Buy {pack.credits} Credit{pack.credits !== 1 ? 's' : ''}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted">
        Secure payment via Stripe. Credits are added instantly and never expire.
      </p>
    </div>
  );
}
