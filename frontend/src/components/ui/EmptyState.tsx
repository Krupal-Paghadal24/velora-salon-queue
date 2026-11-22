import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <Card variant="subtle" padding="lg" className={`text-center space-y-4 max-w-md mx-auto ${className}`}>
      {icon && (
        <div className="w-12 h-12 mx-auto rounded-2xl bg-velora-ivory-200 flex items-center justify-center text-velora-green/70">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="font-serif text-lg font-semibold text-velora-green">{title}</h3>
        <p className="text-sm text-velora-green/70 leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </Card>
  );
};
