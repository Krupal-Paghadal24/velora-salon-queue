import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-velora-green">
            {label}
          </label>
        )}
        <div className="relative rounded-xl">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-velora-green/50">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full min-h-[44px] rounded-xl border bg-white px-3.5 py-2.5 text-sm text-velora-green placeholder-velora-green/40 transition-colors focus:outline-none focus:ring-2 focus:ring-velora-copper/30 focus:border-velora-copper disabled:opacity-50 disabled:bg-velora-ivory-100 ${
              leftIcon ? 'pl-10' : ''
            } ${
              error
                ? 'border-velora-red focus:border-velora-red focus:ring-velora-red/30'
                : 'border-velora-ivory-300'
            } ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-velora-red font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-velora-green/60">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
