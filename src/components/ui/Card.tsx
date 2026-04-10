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
          'bg-card border border-border rounded-lg transition-colors duration-200',
          padding && 'p-6',
          hover && 'hover:bg-card-hover hover:shadow-md transition-shadow cursor-pointer',
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
