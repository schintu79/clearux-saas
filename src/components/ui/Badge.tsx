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

const Badge: React.FC<BadgeProps> = ({
  variant,
  size = 'default',
  children,
  className,
}) => {
  const variantStyles = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    active: 'bg-blue-lt text-blue',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    danger: 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs font-medium rounded-lg',
    default: 'px-3 py-1.5 text-sm font-medium rounded-lg',
  };

  return (
    <span
      className={clsx(
        variantStyles[variant],
        sizeStyles[size],
        'inline-block',
        className
      )}
    >
      {children}
    </span>
  );
};

export default Badge;
