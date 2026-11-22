import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'copper' | 'secondary' | 'outline' | 'destructive' | 'ghost';
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
      'bg-velora-green text-velora-ivory hover:bg-velora-green-dark focus:ring-velora-green shadow-sm',
    copper:
      'bg-velora-copper text-white hover:bg-velora-copper-dark focus:ring-velora-copper shadow-sm',
    secondary:
      'bg-velora-ivory-200 text-velora-green hover:bg-velora-ivory-300 focus:ring-velora-green/40 border border-velora-ivory-300',
    outline:
      'bg-transparent text-velora-green border border-velora-green/30 hover:bg-velora-green/5 focus:ring-velora-green/40',
    destructive:
      'bg-velora-red text-white hover:bg-velora-red/90 focus:ring-velora-red shadow-sm',
    ghost:
      'bg-transparent text-velora-green hover:bg-velora-ivory-200 focus:ring-velora-green/30',
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
