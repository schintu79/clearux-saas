'use client';

/**
 * CustomSelect — a styled dropdown that replaces native <select>
 * to avoid OS-level dropdown rendering issues (dark backgrounds,
 * checkmarks) on macOS Chrome/Safari.
 *
 * Drop-in replacement: same props pattern as a native select wrapper.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
  /** Background when an active (non-default) value is selected */
  activeBg?: string;
  /** Border when active */
  activeBorder?: string;
  /** Text color when active */
  activeColor?: string;
  /** Background when inactive / default */
  inactiveBg?: string;
  /** Border when inactive */
  inactiveBorder?: string;
  /** Text color when inactive */
  inactiveColor?: string;
  /** Whether the current value counts as "active" (non-default). If not provided, value !== first option is used */
  isActive?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

export default function CustomSelect({
  value,
  onChange,
  options,
  label,
  disabled = false,
  activeBg = 'var(--ink)',
  activeBorder = 'var(--ink)',
  activeColor = 'var(--paper)',
  inactiveBg = 'var(--card)',
  inactiveBorder = 'var(--rule)',
  inactiveColor = 'var(--ink)',
  isActive: isActiveProp,
  size = 'sm',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = isActiveProp ?? value !== options[0]?.value;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  const py = size === 'sm' ? 'py-1' : 'py-1.5';
  const pl = size === 'sm' ? 'pl-2.5' : 'pl-3';
  const pr = size === 'sm' ? 'pr-5' : 'pr-6';
  const text = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`${text} font-medium ${pl} ${pr} ${py} rounded-md outline-none cursor-pointer inline-flex items-center gap-1 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-signal/30`}
        style={{
          background: isActive ? activeBg : inactiveBg,
          border: `1px solid ${isActive ? activeBorder : inactiveBorder}`,
          color: isActive ? activeColor : inactiveColor,
        }}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selectedLabel}
        <ChevronDown
          size={11}
          className="flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 min-w-full rounded-lg shadow-lg overflow-hidden z-50"
          style={{
            background: '#ffffff',
            border: '1px solid var(--rule)',
          }}
          role="listbox"
          aria-label={label}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full text-left ${text} px-3 py-1.5 flex items-center justify-between gap-3 transition-colors hover:bg-[var(--paper-2)]`}
                style={{
                  color: 'var(--ink)',
                  fontWeight: selected ? 600 : 400,
                  background: selected ? 'var(--paper-2)' : 'transparent',
                }}
              >
                <span className="whitespace-nowrap">{o.label}</span>
                {selected && (
                  <Check size={11} className="flex-shrink-0" style={{ color: 'var(--signal)' }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
