'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, CheckCircle, ArrowRight, CreditCard, Zap, Crown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SUBSCRIPTION_PLANS, CREDIT_PACKS, formatPrice } from '@/lib/pricing';
import type { BillingInterval } from '@/lib/pricing';

type PricingMode = 'subscription' | 'credits';

export default function BuyCreditsPage() {
  const { user, loading: userLoading } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [mode, setMode] = useState<PricingMode>('credits');
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? 0);
        setSubscription(d.subscription_plan ?? null);
      })
      .catch(() => setCredits(0));
  }, [user]);

  const handleCreditPurchase = async (packId: string) => {
    setPurchasing(packId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to create checkout');
      window.location.href = data.url;
    } catch (err) {
      console.error('Purchase error:', err);
      setPurchasing(null);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleSubscribe = async (planId: string) => {
    setPurchasing(planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: planId, interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to create checkout');
      window.location.href = data.url;
    } catch (err) {
      console.error('Subscribe error:', err);
      setPurchasing(null);
      alert('Something went wrong. Please try again.');
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ink)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      <div className="text-center mb-10">
        <h1 className="text-xl font-medium font-sans mb-2" style={{ color: 'var(--ink)' }}>
          Plans and credits
        </h1>
        <p className="text-[14px] max-w-md mx-auto" style={{ color: 'var(--m-muted)' }}>
          Subscribe for monthly re-audits and workspaces, or buy credit packs for one-time audits.
        </p>

        {/* Current status */}
        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
          {credits !== null && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'color-mix(in srgb, var(--ok) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}>
              <Coins size={14} style={{ color: 'var(--ok)' }} />
              <span className="text-sm font-medium text-text">
                {credits} credit{credits !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {subscription && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
              <CreditCard size={14} style={{ color: 'var(--ink)' }} />
              <span className="text-sm font-medium text-text capitalize">
                {subscription} plan
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setMode('subscription')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
            mode === 'subscription'
              ? 'bg-off text-text border border-border'
              : 'text-muted hover:text-text'
          }`}
        >
          <CreditCard size={15} />
          Subscriptions
        </button>
        <button
          onClick={() => setMode('credits')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
            mode === 'credits'
              ? 'bg-off text-text border border-border'
              : 'text-muted hover:text-text'
          }`}
        >
          <Zap size={15} />
          Credit packs
        </button>
      </div>

      {/* Subscriptions */}
      {mode === 'subscription' && (
        <>
          {/* Billing interval */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                interval === 'monthly' ? 'bg-off text-text border border-border' : 'text-muted hover:text-text'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('yearly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                interval === 'yearly' ? 'bg-off text-text border border-border' : 'text-muted hover:text-text'
              }`}
            >
              Yearly
              <span className="text-[10px] font-medium tracking-[0.1em] uppercase" style={{ color: 'var(--ok)' }}>save 20%</span>
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const price = interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
              const isCurrentPlan = subscription === plan.id;
              return (
                <div
                  key={plan.id}
                  className="relative rounded-xl p-6 transition-all duration-200"
                  style={{
                    background: 'var(--paper)',
                    border: plan.popular ? '2px solid var(--ink)' : '1px solid var(--rule)',
                  }}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 right-4 text-[11px] font-medium px-2.5 py-0.5 rounded-full shadow-sm" style={{ background: 'var(--ink)', color: '#FFFFFF' }}>
                      Most popular
                    </span>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-sans font-normal text-lg text-text">{plan.name}</h3>
                  </div>

                  <div className="mb-1">
                    <span className="font-sans text-[36px] font-normal text-text">
                      {formatPrice(price)}
                    </span>
                    <span className="text-sm text-muted">/mo</span>
                  </div>
                  {interval === 'yearly' && (
                    <p className="text-xs text-muted mb-3">
                      <span className="line-through opacity-50">{formatPrice(plan.monthlyPrice)}/mo</span>
                      {' '}billed annually
                    </p>
                  )}
                  {interval === 'monthly' && <div className="mb-3" />}

                  <div className="space-y-1.5 mb-5">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle size={13} className="flex-shrink-0" style={{ color: 'var(--ok)' }} />
                        <span className="text-xs text-muted">{f}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={purchasing !== null || isCurrentPlan}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-medium text-sm transition-all disabled:opacity-50"
                    style={
                      isCurrentPlan
                        ? { background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)', cursor: 'default' }
                        : plan.popular
                          ? { background: 'var(--ink)', color: 'var(--paper)' }
                          : { background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }
                    }
                  >
                    {purchasing === plan.id ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : isCurrentPlan ? (
                      'Current plan'
                    ) : (
                      <>
                        Subscribe
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Credits */}
      {mode === 'credits' && (
        <>
          <p className="text-center text-sm text-muted mb-6">
            No subscription required. One credit = one full audit. Credits never expire.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="relative rounded-xl p-6 transition-all duration-200"
                style={{
                  background: 'var(--paper)',
                  border: pack.popular ? '2px solid var(--ink)' : '1px solid var(--rule)',
                }}
              >
                {pack.popular && (
                  <span className="absolute -top-2.5 right-4 text-[11px] font-medium px-2.5 py-0.5 rounded-full shadow-sm" style={{ background: 'var(--ink)', color: '#FFFFFF' }}>
                    Best value
                  </span>
                )}

                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-sans font-normal text-lg text-text">
                    {pack.credits} Credit{pack.credits !== 1 ? 's' : ''}
                  </h3>
                  {pack.savePercent && (
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--ok)', color: '#FFFFFF' }}>
                      Save {pack.savePercent}%
                    </span>
                  )}
                </div>

                <div className="mb-1">
                  <span className="font-sans text-3xl font-normal">
                    {formatPrice(pack.price)}
                  </span>
                </div>
                <p className="text-xs text-muted mb-3">{pack.perAudit} per audit</p>

                <div className="space-y-1.5 mb-5">
                  {pack.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle size={13} className="flex-shrink-0" style={{ color: 'var(--ok)' }} />
                      <span className="text-xs text-muted">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleCreditPurchase(pack.id)}
                  disabled={purchasing !== null}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-medium text-sm transition-all disabled:opacity-50"
                  style={
                    pack.popular
                      ? { background: 'var(--ink)', color: 'var(--paper)' }
                      : { background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }
                  }
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
        </>
      )}

      <p className="text-center text-xs text-muted">
        Secure payment via Stripe. Satisfied or refunded — no friction. Cancel subscriptions anytime.
      </p>
    </div>
  );
}
