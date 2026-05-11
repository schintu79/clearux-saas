import React from 'react';
import clsx from 'clsx';

type BadgeVariant = 'pending' | 'active' | 'completed' | 'failed' | 'danger';
type BadgeSize = 'sm' | 'default';

interface BadgeProps {
  variant: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(154, 122, 44, 0.10)', color: 'var(--warn)' },
  active:    { bg: 'var(--signal-soft)',         color: 'var(--signal)' },
  completed: { bg: 'rgba(63, 107, 63, 0.10)',   color: 'var(--ok)' },
  failed:    { bg: 'rgba(139, 58, 44, 0.10)',   color: 'var(--severe)' },
  danger:    { bg: 'rgba(139, 58, 44, 0.15)',   color: 'var(--severe)' },
};

const Badge: React.FC<BadgeProps> = ({
  variant,
  size = 'default',
  children,
  className,
}) => {
  const v = variantMap[variant];

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-[11px] font-mono tracking-[0.04em] uppercase rounded-full',
    default: 'px-3 py-1.5 text-[12px] font-medium rounded-full',
  };

  return (
    <span
      className={clsx(sizeStyles[size], 'inline-block', className)}
      style={{ background: v.bg, color: v.color }}
    >
      {children}
    </span>
  );
};

export default Badge;
