import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Clock, MapPin, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="mt-auto bg-velora-ivory-200/80 border-t border-velora-ivory-300 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-velora-green/80">
          {/* Brand info */}
          <div className="space-y-1.5">
            <h4 className="font-serif font-bold text-sm text-velora-green">{t('brand.name')}</h4>
            <p className="leading-relaxed">{t('brand.tagline')}</p>
          </div>

          {/* Operating hours */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 font-semibold text-velora-green">
              <Clock className="w-3.5 h-3.5 text-velora-copper" />
              <span>Salon Hours</span>
            </div>
            <p className="leading-relaxed">{t('salon.hours')}</p>
          </div>

          {/* Location & Privacy */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 font-semibold text-velora-green">
              <MapPin className="w-3.5 h-3.5 text-velora-copper" />
              <span>Location</span>
            </div>
            <p className="leading-relaxed">{t('salon.address')}</p>
            <div className="flex items-center space-x-1.5 text-[11px] text-velora-sage-dark pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-velora-sage" />
              <span>{t('footer.privacy')}</span>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-velora-ivory-300/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-velora-green/60">
          <p>{t('footer.copyright')}</p>
          <p className="mt-1 sm:mt-0 font-medium text-velora-copper">{t('brand.phase3')}</p>
        </div>
      </div>
    </footer>
  );
};
