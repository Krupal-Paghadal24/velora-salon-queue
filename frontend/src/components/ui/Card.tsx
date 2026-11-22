import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'forest';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-150';

  const variants = {
    default: 'bg-white border border-velora-ivory-300 shadow-sm',
    elevated: 'bg-white border border-velora-ivory-300 shadow-md',
    subtle: 'bg-velora-ivory-100 border border-velora-ivory-200',
    forest: 'bg-velora-green text-velora-ivory border border-velora-green-dark shadow-sm',
  };

  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
};
