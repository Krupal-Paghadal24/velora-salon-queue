import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Barber, StaffBarber, QueueStatus } from '@velora/shared';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { StaffGate } from '../auth/StaffAuth';
import { apiFetch, ApiError } from '../api/client';
import { useLiveResource, useNow } from '../hooks/useLiveResource';
import { formatToken, minutesBetween } from '../utils/format';
import { Check, Coffee, Play, PhoneCall, UserX, WifiOff } from 'lucide-react';

interface BarberView {
  barber: StaffBarber;
  active: {
    id: string;
    daily_token: number;
    status: QueueStatus;
    customer_name: string;
    total_duration_minutes: number;
    called_at: string | null;
    started_at: string | null;
    services: Array<{ name_en: string; name_gu: string; duration_minutes: number }>;
  } | null;
  next: {
    daily_token: number;
    total_duration_minutes: number;
    joined_at: string;
    requested_me: boolean;
    services: Array<{ name_en: string; name_gu: string; duration_minutes: number }>;
  } | null;
  compatible_waiting_count: number;
}

const Station: React.FC<{ barberId: string; token: string }> = ({ barberId, token }) => {
  const { t, language } = useLanguage();
  const now = useNow(30000);
  const { data, error, loading, connected, refresh } = useLiveResource<BarberView>(
    () => apiFetch<BarberView>(`/api/staff/barber/${barberId}`, { token }),
    barberId,
    15000
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (key: string, path: string, method = 'POST', body: unknown = {}) => {
    setBusy(key);
    setActionError(null);
    try {
      await apiFetch(path, { method, body, token });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : t('common.error'));
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  if (loading && !data) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (!data) {
    return (
      <Card variant="subtle" padding="md" className="max-w-md mx-auto text-sm text-velora-red flex items-center justify-between gap-3">
        <span>{error?.message || t('common.error')}</span>
        <Button variant="secondary" size="sm" onClick={refresh}>
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const { barber, active, next } = data;
  const svcText = (list: Array<{ name_en: string; name_gu: string; duration_minutes: number }>) =>
    list.map((s) => `${language === 'gu' ? s.name_gu : s.name_en} (${s.duration_minutes} ${t('common.minutes')})`).join(', ');
  const canCall = barber.is_on_duty && barber.status === 'AVAILABLE' && !active;
  const elapsed = active?.started_at ? minutesBetween(active.started_at, now) : 0;
  const remaining = active ? Math.max(0, active.total_duration_minutes - elapsed) : 0;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-velora-ivory-300 pb-4 gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-velora-charcoal">{barber.name}</h1>
          <p className="text-xs text-velora-charcoal-light">{barber.speciality || t('barber.station')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {barber.is_on_duty ? (
            <Badge status={active ? 'BUSY' : barber.status} size="sm" />
          ) : (
            <Badge variant="neutral" label={t('barber.off_duty')} size="sm" />
          )}
          {!connected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-velora-red">
              <WifiOff className="w-3 h-3" /> {t('track.reconnecting')}
            </span>
          )}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="p-3 rounded-xl bg-white border border-velora-red/40 text-xs font-medium text-velora-red">
          {actionError}
        </div>
      )}

      <Card variant="elevated" padding="lg" className="space-y-5 text-center">
        {active ? (
          <>
            <Badge status={active.status} size="md" pulse className="mx-auto" />
            <div className="space-y-1">
              <p className="font-serif text-5xl font-extrabold text-velora-charcoal">{formatToken(active.daily_token)}</p>
              <p className="text-base font-medium text-velora-charcoal">{active.customer_name}</p>
            </div>
            <div className="p-3 bg-velora-ivory-100 rounded-xl border border-velora-ivory-200 text-xs text-velora-charcoal-light text-left space-y-1">
              <p className="font-semibold text-velora-charcoal">{svcText(active.services)}</p>
              <p className="text-velora-charcoal-light">
                {active.status === 'CALLED'
                  ? t('barber.calledMsg')
                  : `${t('barber.elapsed')}: ${elapsed} ${t('common.minutes')} / ${t('barber.remaining')}: ~${remaining} ${t('common.minutes')}`}
              </p>
            </div>
            <div className="pt-2 space-y-2">
              {active.status === 'CALLED' ? (
                <>
                  <Button size="lg" className="w-full" leftIcon={<Play className="w-5 h-5" />} isLoading={busy === 'start'} onClick={() => act('start', `/api/staff/queue/${active.id}/start`)}>
                    {t('action.startService')}
                  </Button>
                  <Button variant="outline" className="w-full" leftIcon={<UserX className="w-4 h-4" />} isLoading={busy === 'noshow'} onClick={() => act('noshow', `/api/staff/queue/${active.id}/no-show`)}>
                    {t('action.markNoShow')}
                  </Button>
                </>
              ) : (
                <Button size="lg" className="w-full" leftIcon={<Check className="w-5 h-5" />} isLoading={busy === 'finish'} onClick={() => act('finish', `/api/staff/queue/${active.id}/finish`)}>
                  {t('action.finishService')}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-velora-charcoal-light font-semibold">{t('barber.noActive')}</p>
            <Button
              size="lg"
              variant={canCall ? 'primary' : 'secondary'}
              className="w-full"
              leftIcon={<PhoneCall className="w-5 h-5" />}
              disabled={!canCall || data.compatible_waiting_count === 0}
              isLoading={busy === 'call'}
              onClick={() => act('call', '/api/staff/queue/call-next', 'POST', { barber_id: barber.id })}
            >
              {t('action.callNext')}
            </Button>
            <p className="text-[11px] text-velora-charcoal-light">{t('barber.callNote')}</p>
          </>
        )}
      </Card>

      <Card variant="subtle" padding="md" className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-velora-charcoal">{t('barber.next')}</span>
          <span className="text-velora-charcoal-light">
            {data.compatible_waiting_count} {t('barber.waitingCount')}
          </span>
        </div>
        {next ? (
          <div className="flex justify-between items-center gap-3">
            <div>
              <p className="font-serif font-bold text-base text-velora-charcoal">{formatToken(next.daily_token)}</p>
              <p className="text-xs text-velora-charcoal-light">
                {svcText(next.services)}
                {next.requested_me ? ` · ${t('barber.requestedMe')}` : ''}
              </p>
            </div>
            <span className="text-xs text-velora-charcoal-light font-medium shrink-0">{minutesBetween(next.joined_at, now)}m</span>
          </div>
        ) : (
          <p className="text-xs text-velora-charcoal-light">{t('barber.nextNone')}</p>
        )}
      </Card>

      {!active && barber.is_on_duty && (
        <Button
          variant="outline"
          className="w-full"
          leftIcon={<Coffee className="w-4 h-4" />}
          isLoading={busy === 'break'}
          onClick={() => act('break', `/api/staff/barbers/${barber.id}/availability`, 'PATCH', { status: barber.status === 'ON_BREAK' ? 'AVAILABLE' : 'ON_BREAK' })}
        >
          {barber.status === 'ON_BREAK' ? t('barber.backToWork') : t('barber.goBreak')}
        </Button>
      )}
    </div>
  );
};

/** Reception/owner opening /barber without an id pick a station from the roster. */
const StationPicker: React.FC = () => {
  const { t } = useLanguage();
  const { data } = useLiveResource<Barber[]>(() => apiFetch<Barber[]>('/api/barbers'), 'barbers-list', 60000);
  return (
    <div className="max-w-md mx-auto space-y-3">
      <h1 className="font-serif text-xl font-bold text-velora-charcoal">{t('barber.pick')}</h1>
      {(data || []).map((b) => (
        <Link key={b.id} to={`/barber/${b.id}`} className="block">
          <Card variant="default" padding="sm" className="flex items-center justify-between hover:border-velora-rose">
            <span className="font-serif font-bold text-velora-charcoal">{b.name}</span>
            <span className="text-xs text-velora-charcoal-light">{b.speciality}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export const BarberPage: React.FC = () => {
  const { barberId } = useParams<{ barberId: string }>();
  return (
    <StaffGate roles={['BARBER', 'RECEPTIONIST', 'OWNER']}>
      {(s) => {
        const id = barberId || s.user.barber_id;
        return id ? <Station barberId={id} token={s.token} /> : <StationPicker />;
      }}
    </StaffGate>
  );
};
