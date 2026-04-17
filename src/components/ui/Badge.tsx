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
    pending: 'bg-[#B8860B]/10 text-[#B8860B] dark:bg-[#D4A84B]/15 dark:text-[#D4A84B]',
    active: 'bg-[#2E6B9E]/10 text-[#2E6B9E] dark:bg-[#6BAED6]/15 dark:text-[#6BAED6]',
    completed: 'bg-[#2D7A4F]/10 text-[#2D7A4F] dark:bg-[#5CB87A]/15 dark:text-[#5CB87A]',
    failed: 'bg-[#C0392B]/10 text-[#C0392B] dark:bg-[#E07B6E]/15 dark:text-[#E07B6E]',
    danger: 'bg-[#C0392B]/15 text-[#C0392B] dark:bg-[#E07B6E]/20 dark:text-[#E07B6E]',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs font-medium rounded-md',
    default: 'px-3 py-1.5 text-sm font-medium rounded-md',
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
