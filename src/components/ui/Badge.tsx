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
    pending: 'bg-[#EAB308]/10 text-[#EAB308] dark:bg-[#D4A84B]/15 dark:text-[#D4A84B]',
    active: 'bg-[#3B82F6]/10 text-[#3B82F6] dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]',
    completed: 'bg-[#22C55E]/10 text-[#22C55E] dark:bg-[#4ADE80]/15 dark:text-[#4ADE80]',
    failed: 'bg-[#EF4444]/10 text-[#EF4444] dark:bg-[#F87171]/15 dark:text-[#F87171]',
    danger: 'bg-[#EF4444]/15 text-[#EF4444] dark:bg-[#F87171]/20 dark:text-[#F87171]',
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
