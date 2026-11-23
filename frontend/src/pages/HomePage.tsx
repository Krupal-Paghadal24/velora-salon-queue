import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PublicSalonSummary } from '@velora/shared';
import { Users, Clock, Scissors, Sparkles, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { t, language } = useLanguage();
  const [data, setData] = useState<PublicSalonSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchSalonSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/salon/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load salon status`);
      const json: PublicSalonSummary = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Server connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalonSummary();
  }, [apiUrl]);

  return (
    <div className="space-y-12 md:space-y-16">
      {/* Error Banner with Retry */}
      {error && (
        <Card variant="subtle" padding="md" className="border-velora-red/30 bg-velora-red-light/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-velora-red shrink-0" />
            <div>
              <p className="text-sm font-semibold text-velora-red">{t('home.errorTitle')}</p>
              <p className="text-xs text-velora-charcoal-light">{error} (Render free tier may take ~45s to wake up)</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchSalonSummary} leftIcon={<RefreshCw className="w-4 h-4" />}>
            {t('home.retryBtn')}
          </Button>
        </Card>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-white border border-velora-ivory-300 p-6 sm:p-10 md:p-14 text-center space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-velora-ivory-200 border border-velora-ivory-300 text-xs text-velora-rose-dark font-medium">
          <Sparkles className="w-3.5 h-3.5 text-velora-gold-dark" />
          <span>Real-time Salon Queue • Asia/Kolkata</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-velora-charcoal tracking-tight max-w-2xl mx-auto leading-tight">
          {t('home.hero.title')}
        </h1>

        <p className="text-sm sm:text-base text-velora-charcoal-light max-w-xl mx-auto leading-relaxed">
          {t('home.hero.subtitle')}
        </p>

        {/* Live Queue Summary Strip */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto pt-2">
          {loading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : (
            <>
              <div className="bg-velora-ivory-100 rounded-2xl p-3 sm:p-4 border border-velora-ivory-200 text-center">
                <div className="flex items-center justify-center text-velora-gold-dark mb-1">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <p className="text-lg sm:text-2xl font-serif font-bold text-velora-charcoal">
                  {data?.stats.waitingCount ?? 0}
                </p>
                <p className="text-[11px] text-velora-charcoal-light font-medium">{t('home.stats.waiting')}</p>
              </div>

              <div className="bg-velora-ivory-100 rounded-2xl p-3 sm:p-4 border border-velora-ivory-200 text-center">
                <div className="flex items-center justify-center text-velora-sage-dark mb-1">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <p className="text-lg sm:text-2xl font-serif font-bold text-velora-charcoal">
                  {data?.stats.approxWaitMinutes ? `~${data.stats.approxWaitMinutes}m` : '0m'}
                </p>
                <p className="text-[11px] text-velora-charcoal-light font-medium">{t('home.stats.wait')}</p>
              </div>

              <div className="bg-velora-ivory-100 rounded-2xl p-3 sm:p-4 border border-velora-ivory-200 text-center">
                <div className="flex items-center justify-center text-velora-gold-dark mb-1">
                  <Scissors className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <p className="text-lg sm:text-2xl font-serif font-bold text-velora-charcoal">
                  {data?.stats.onDutyBarbersCount ?? 0}
                </p>
                <p className="text-[11px] text-velora-charcoal-light font-medium">{t('home.stats.barbers')}</p>
              </div>
            </>
          )}
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <Link to="/join">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              disabled={data?.salon.isOpen === false || data?.salon.isOnlineJoiningEnabled === false}
            >
              {t('action.join')}
            </Button>
          </Link>
          {data?.salon.isOnlineJoiningEnabled === false && (
            <p className="text-xs text-velora-amber font-medium mt-2">
              Online joining is currently closed for the day. Walk-ins are accepted at reception.
            </p>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="font-serif text-2xl font-bold text-velora-charcoal">
            {t('home.howItWorks.title')}
          </h2>
          <p className="text-xs text-velora-charcoal-light">Simple, transparent, stress-free salon visits</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="default" padding="md" className="space-y-3">
            <div className="w-8 h-8 rounded-xl bg-velora-rose-light text-velora-rose-dark font-serif font-bold flex items-center justify-center text-sm">
              1
            </div>
            <h3 className="font-serif text-base font-semibold text-velora-charcoal">
              {t('home.step1.title')}
            </h3>
            <p className="text-xs text-velora-charcoal-light leading-relaxed">{t('home.step1.desc')}</p>
          </Card>

          <Card variant="default" padding="md" className="space-y-3">
            <div className="w-8 h-8 rounded-xl bg-velora-sage-light text-velora-sage-dark font-serif font-bold flex items-center justify-center text-sm">
              2
            </div>
            <h3 className="font-serif text-base font-semibold text-velora-charcoal">
              {t('home.step2.title')}
            </h3>
            <p className="text-xs text-velora-charcoal-light leading-relaxed">{t('home.step2.desc')}</p>
          </Card>

          <Card variant="default" padding="md" className="space-y-3">
            <div className="w-8 h-8 rounded-xl bg-velora-ivory-200 text-velora-charcoal font-serif font-bold flex items-center justify-center text-sm">
              3
            </div>
            <h3 className="font-serif text-base font-semibold text-velora-charcoal">
              {t('home.step3.title')}
            </h3>
            <p className="text-xs text-velora-charcoal-light leading-relaxed">{t('home.step3.desc')}</p>
          </Card>
        </div>
      </section>

      {/* Real Barbers Roster */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-velora-charcoal">{t('home.barbers.title')}</h2>
            <p className="text-xs text-velora-charcoal-light">Real-time status of our on-duty specialists</p>
          </div>
          <Badge status="AVAILABLE" size="sm" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.barbers.map((barber) => (
              <Card key={barber.id} variant="subtle" padding="sm" className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-semibold text-sm text-velora-charcoal">{barber.name}</span>
                  <Badge status={barber.status} size="sm" />
                </div>
                <p className="text-xs text-velora-charcoal-light">{barber.speciality || 'Styling Specialist'}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Real Services Catalogue */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="font-serif text-2xl font-bold text-velora-charcoal">{t('home.services.title')}</h2>
          <p className="text-xs text-velora-charcoal-light">All prices in Indian Rupees (₹) including estimated durations</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : data?.services && data.services.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.services.map((service) => (
              <Card key={service.id} variant="default" padding="sm" className="flex justify-between items-center">
                <div>
                  <p className="font-serif font-semibold text-sm text-velora-charcoal">
                    {language === 'gu' ? service.name_gu : service.name_en}
                  </p>
                  <p className="text-xs text-velora-charcoal-light">
                    {language === 'gu' ? service.name_en : service.name_gu} • {service.duration_minutes}m
                  </p>
                </div>
                <span className="font-serif font-bold text-velora-rose-dark text-sm">
                  ₹{Number(service.price_inr).toFixed(0)}
                </span>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Services Listed"
            description={t('home.emptyServices')}
            actionLabel={t('action.refresh')}
            onAction={fetchSalonSummary}
          />
        )}
      </section>
    </div>
  );
};
