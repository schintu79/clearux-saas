import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  padding?: boolean;
  hover?: boolean;
  className?: string;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, padding = true, hover = false, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'bg-card border border-border/60 rounded-2xl transition-all duration-200 shadow-sm',
          padding && 'p-6',
          hover && 'hover:bg-card-hover hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5 cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
