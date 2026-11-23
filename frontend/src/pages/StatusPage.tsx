import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { CustomerQueueStatusResponse } from '@velora/shared';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { apiFetch, ApiError } from '../api/client';
import { useLiveResource } from '../hooks/useLiveResource';
import { formatToken } from '../utils/format';
import { Clock, Scissors, ArrowLeft, RefreshCw, AlertCircle, WifiOff } from 'lucide-react';

export const StatusPage: React.FC = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const { t, language } = useLanguage();

  const { data: entry, error, loading, connected, updatedAt, refresh } = useLiveResource<CustomerQueueStatusResponse>(
    () => apiFetch<CustomerQueueStatusResponse>(`/api/queue/${publicId}`),
    publicId || '',
    15000,
    Boolean(publicId)
  );

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await apiFetch(`/api/queue/${publicId}/cancel`, { method: 'POST', body: {} });
      setConfirming(false);
      await refresh();
    } catch (e) {
      setCancelError(e instanceof ApiError ? e.message : t('track.cancelFailed'));
      await refresh(); // status may have changed (e.g. just called)
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !entry) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Card variant="elevated" padding="lg" className="space-y-6">
          <Skeleton className="h-8 w-24 mx-auto rounded-full" />
          <Skeleton className="h-20 w-40 mx-auto" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </Card>
      </div>
    );
  }

  if (!entry) {
    const notFound = error?.status === 404 || error?.status === 400;
    return (
      <div className="max-w-xl mx-auto py-8">
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-velora-red" />}
          title={notFound ? t('track.notFoundTitle') : t('common.error')}
          description={notFound ? t('track.notFoundDesc') : error?.message || t('common.error')}
          actionLabel={notFound ? t('action.back') : t('common.retry')}
          onAction={() => (notFound ? window.location.assign('/') : refresh())}
        />
      </div>
    );
  }

  const status = entry.status;
  const isActive = status === 'WAITING' || status === 'CALLED' || status === 'IN_SERVICE';
  const barberLabel = entry.assigned_barber_name
    ? entry.assigned_barber_name
    : entry.preferred_barber_name
    ? `${entry.preferred_barber_name} (${t('track.requestedBarber')})`
    : t('track.anyBarber');

  const waitText =
    entry.estimated_wait_minutes === null
      ? t('track.waitUnavailable')
      : `~${entry.estimated_wait_minutes} ${t('common.minutes')}`;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center text-xs font-semibold text-velora-rose-dark hover:underline space-x-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('action.back')}</span>
        </Link>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
            connected ? 'text-velora-sage-dark' : 'text-velora-red'
          }`}
        >
          {connected ? <Clock className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? t('track.live') : t('track.reconnecting')}
        </span>
      </div>

      <Card variant="elevated" padding="lg" className="text-center space-y-6">
        <div className="flex justify-center">
          <Badge status={status} size="md" pulse={status === 'WAITING' || status === 'CALLED'} />
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-velora-charcoal-light font-semibold">{t('status.token')}</p>
          <p className="font-serif text-6xl font-extrabold text-velora-charcoal tracking-tight">
            {formatToken(entry.daily_token)}
          </p>
          <p className="text-sm font-semibold text-velora-charcoal">{entry.customer_name}</p>
          <p className="text-xs text-velora-charcoal-light">
            {t('track.joinedAt')}{' '}
            {new Date(entry.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {entry.salon_date}
          </p>
        </div>

        {status === 'WAITING' && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-velora-ivory-100 rounded-2xl p-4 border border-velora-ivory-200">
              <p className="text-2xl font-serif font-bold text-velora-charcoal">{entry.position_ahead ?? '—'}</p>
              <p className="text-[11px] text-velora-charcoal-light">{t('track.positionAhead')}</p>
            </div>
            <div className="bg-velora-ivory-100 rounded-2xl p-4 border border-velora-ivory-200">
              <p
                className={`font-serif font-bold text-velora-rose-dark ${
                  entry.estimated_wait_minutes === null ? 'text-sm pt-1.5' : 'text-2xl'
                }`}
              >
                {waitText}
              </p>
              <p className="text-[11px] text-velora-charcoal-light">
                {t('status.estWait')} ({t('track.approx')})
              </p>
            </div>
          </div>
        )}

        {status === 'CALLED' && (
          <div className="p-4 rounded-2xl bg-velora-rose-dark text-white text-sm font-semibold animate-pulse" role="status">
            {t('track.yourTurn')} {entry.assigned_barber_name || ''}
          </div>
        )}
        {status === 'IN_SERVICE' && (
          <div className="p-4 rounded-2xl bg-velora-ivory-100 border border-velora-ivory-200 text-sm font-semibold text-velora-charcoal">
            {t('track.inService')}
          </div>
        )}
        {status === 'DONE' && (
          <div className="p-4 rounded-2xl bg-velora-ivory-100 border border-velora-ivory-200 text-sm font-semibold text-velora-charcoal">
            {t('track.doneMsg')}
          </div>
        )}
        {status === 'CANCELLED' && (
          <div className="p-4 rounded-2xl bg-velora-ivory-100 border border-velora-ivory-200 text-sm text-velora-charcoal">
            {t('track.cancelledMsg')}
          </div>
        )}
        {status === 'NO_SHOW' && (
          <div className="p-4 rounded-2xl bg-velora-ivory-100 border border-velora-ivory-200 text-sm text-velora-charcoal">
            {t('track.noShowMsg')}
          </div>
        )}

        <div className="text-left bg-velora-ivory-100 rounded-2xl p-4 border border-velora-ivory-200 text-xs space-y-2">
          <div className="flex justify-between items-center text-velora-charcoal font-medium">
            <span className="flex items-center space-x-1.5">
              <Scissors className="w-3.5 h-3.5 text-velora-gold-dark" />
              <span>
                {t('track.services')} ({entry.total_duration_minutes} {t('common.minutes')})
              </span>
            </span>
            <span className="font-serif font-bold">₹{entry.total_price_inr.toFixed(0)}</span>
          </div>
          <ul className="text-velora-charcoal-light space-y-0.5">
            {entry.services.map((s, i) => (
              <li key={i}>
                {language === 'gu' ? s.name_gu : s.name_en} · {s.duration_minutes} {t('common.minutes')}
              </li>
            ))}
          </ul>
          <p className="text-velora-charcoal-light">
            {t('track.specialist')}: <strong className="text-velora-charcoal">{barberLabel}</strong>
          </p>
        </div>

        {status === 'WAITING' && (
          <div className="space-y-2">
            {!confirming ? (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setConfirming(true)}>
                {t('action.cancel')}
              </Button>
            ) : (
              <div className="p-4 rounded-2xl border border-velora-red/30 bg-white space-y-3">
                <p className="text-sm font-semibold text-velora-charcoal">{t('track.cancelConfirm')}</p>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" className="flex-1" isLoading={cancelling} onClick={cancel}>
                    {t('track.cancelYes')}
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
                    {t('track.keep')}
                  </Button>
                </div>
              </div>
            )}
            {cancelError && <p className="text-xs text-velora-red font-medium" role="alert">{cancelError}</p>}
          </div>
        )}

        {!isActive && (
          <Link to="/join" className="inline-block text-xs font-semibold text-velora-rose-dark hover:underline">
            {t('nav.join')}
          </Link>
        )}

        <div className="flex items-center justify-center space-x-2 text-xs text-velora-charcoal-light pt-2">
          <span>
            {t('common.refreshed')}{' '}
            {updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </span>
          {error && <span className="text-velora-red">· {t('track.reconnecting')}</span>}
          <button onClick={refresh} className="p-2 hover:text-velora-charcoal transition-colors" title={t('action.refresh')} aria-label={t('action.refresh')}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </Card>
    </div>
  );
};
