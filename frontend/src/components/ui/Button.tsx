import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const variants = {
    primary:
      'bg-velora-burgundy text-white hover:bg-velora-burgundy-dark focus:ring-velora-burgundy shadow-sm',
    secondary:
      'bg-velora-rose-dark text-white hover:bg-velora-burgundy-dark focus:ring-velora-rose border border-velora-rose-dark',
    outline:
      'bg-transparent text-velora-charcoal border border-velora-charcoal/30 hover:bg-velora-charcoal/5 focus:ring-velora-charcoal/40',
    destructive:
      'bg-velora-red text-white hover:bg-velora-red/90 focus:ring-velora-red shadow-sm',
    ghost:
      'bg-transparent text-velora-charcoal hover:bg-velora-ivory-200 focus:ring-velora-charcoal/30',
  };

  // Min touch target 44px on md & lg
  const sizes = {
    sm: 'min-h-[38px] px-3 py-1.5 text-xs gap-1.5',
    md: 'min-h-[44px] px-4 py-2.5 text-sm gap-2',
    lg: 'min-h-[52px] px-6 py-3 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
