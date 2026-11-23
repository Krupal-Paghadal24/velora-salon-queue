import React from 'react';
import { QueueStatus, BarberStatus } from '@velora/shared';
import { useLanguage } from '../../i18n/LanguageContext';

export interface BadgeProps {
  status?: QueueStatus | BarberStatus | 'open' | 'closed' | string;
  label?: string;
  variant?: 'sage' | 'rose' | 'amber' | 'red' | 'neutral';
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  label,
  variant,
  size = 'md',
  pulse = false,
  className = '',
}) => {
  const { t } = useLanguage();

  // Determine appearance based on status if variant not explicitly provided
  let determinedVariant: 'sage' | 'rose' | 'amber' | 'red' | 'neutral' = variant || 'neutral';
  let displayLabel = label;

  if (status) {
    switch (status) {
      case 'WAITING':
        determinedVariant = 'amber';
        displayLabel = displayLabel || t('status.waiting');
        break;
      case 'CALLED':
        determinedVariant = 'rose';
        displayLabel = displayLabel || t('status.called');
        break;
      case 'IN_SERVICE':
        determinedVariant = 'sage';
        displayLabel = displayLabel || t('status.in_service');
        break;
      case 'DONE':
        determinedVariant = 'neutral';
        displayLabel = displayLabel || t('status.done');
        break;
      case 'CANCELLED':
        determinedVariant = 'red';
        displayLabel = displayLabel || t('status.cancelled');
        break;
      case 'NO_SHOW':
        determinedVariant = 'red';
        displayLabel = displayLabel || t('status.no_show');
        break;
      case 'AVAILABLE':
      case 'open':
        determinedVariant = 'sage';
        displayLabel = displayLabel || (status === 'open' ? t('salon.open') : t('barber.available'));
        break;
      case 'BUSY':
        determinedVariant = 'amber';
        displayLabel = displayLabel || t('barber.busy');
        break;
      case 'ON_BREAK':
      case 'closed':
        determinedVariant = 'neutral';
        displayLabel = displayLabel || (status === 'closed' ? t('salon.closed') : t('barber.on_break'));
        break;
      default:
        determinedVariant = 'neutral';
        displayLabel = displayLabel || String(status);
    }
  }

  const variantStyles = {
    sage: 'bg-velora-sage-light text-velora-sage-dark border-velora-sage/30',
    rose: 'bg-velora-rose-light text-velora-rose-dark border-velora-rose/40',
    amber: 'bg-velora-amber-light text-velora-amber border-velora-amber/30',
    red: 'bg-velora-red-light text-velora-red border-velora-red/30',
    neutral: 'bg-velora-ivory-200 text-velora-charcoal-light border-velora-ivory-300',
  };

  const dotColors = {
    sage: 'bg-velora-sage',
    rose: 'bg-velora-rose-dark',
    amber: 'bg-velora-amber',
    red: 'bg-velora-red',
    neutral: 'bg-velora-charcoal/40',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[determinedVariant]} ${sizeStyles[size]} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[determinedVariant]} ${
          pulse ? 'animate-pulse' : ''
        }`}
      />
      <span>{displayLabel}</span>
    </span>
  );
};
