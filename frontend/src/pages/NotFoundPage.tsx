import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { EmptyState } from '../components/ui/EmptyState';
import { FileQuestion } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="py-12">
      <EmptyState
        icon={<FileQuestion className="w-6 h-6 text-velora-copper" />}
        title={t('notfound.title')}
        description={t('notfound.desc')}
      />
      <div className="text-center pt-6">
        <Link
          to="/"
          className="inline-flex items-center text-xs font-semibold text-velora-copper hover:underline"
        >
          {t('notfound.action')} →
        </Link>
      </div>
    </div>
  );
};
