import React, { useEffect, useState } from 'react';
import type { StaffBoardResponse, StaffBarber, Service, Barber } from '@velora/shared';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { StaffGate } from '../auth/StaffAuth';
import { apiFetch, ApiError } from '../api/client';
import { useLiveResource, useNow } from '../hooks/useLiveResource';
import { formatToken, minutesBetween } from '../utils/format';
import { UserPlus, WifiOff } from 'lucide-react';

const ReceptionBoard: React.FC<{ token: string }> = ({ token }) => {
  const { t, language } = useLanguage();
  const now = useNow(30000);
  const { data: board, error, loading, connected, refresh } = useLiveResource<StaffBoardResponse>(
    () => apiFetch<StaffBoardResponse>('/api/staff/queue', { token }),
    'reception',
    15000
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showWalkin, setShowWalkin] = useState(false);

  const act = async (key: string, path: string, method = 'POST', body: unknown = {}) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await apiFetch<{ called?: boolean; message?: string }>(path, { method, body, token });
      if (res && res.called === false && res.message) setNotice({ kind: 'ok', text: res.message });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof ApiError ? e.message : t('common.error') });
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const svcNames = (e: StaffBoardResponse['entries'][number]) =>
    e.services.map((s) => (language === 'gu' ? s.name_gu : s.name_en)).join(', ');

  const waiting = board?.entries.filter((e) => e.status === 'WAITING') ?? [];
  const activeFor = (b: StaffBarber) => board?.entries.find((e) => e.id === b.active_entry_id) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-velora-ivory-300 pb-4">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-velora-charcoal">{t('reception.title')}</h1>
          <p className="text-xs text-velora-charcoal-light">{t('reception.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {!connected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-velora-red">
              <WifiOff className="w-3 h-3" /> {t('track.reconnecting')}
            </span>
          )}
          <Button variant="primary" size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => setShowWalkin(true)}>
            {t('action.addWalkin')}
          </Button>
        </div>
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-xl text-xs font-medium border ${
            notice.kind === 'error' ? 'bg-white border-velora-red/40 text-velora-red' : 'bg-velora-ivory-100 border-velora-ivory-200 text-velora-charcoal'
          }`}
        >
          {notice.text}
        </div>
      )}

      {showWalkin && (
        <WalkinForm
          token={token}
          onClose={() => setShowWalkin(false)}
          onDone={async (msg) => {
            setShowWalkin(false);
            setNotice({ kind: 'ok', text: msg });
            await refresh();
          }}
        />
      )}

      {loading && !board && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}
      {error && !board && (
        <Card variant="subtle" padding="md" className="text-sm text-velora-red flex items-center justify-between gap-3">
          <span>{error.message}</span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            {t('common.retry')}
          </Button>
        </Card>
      )}

      {board && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('rec.waiting'), value: board.stats.waiting, cls: 'text-velora-charcoal' },
              { label: t('rec.inService'), value: board.stats.in_service + board.stats.called, cls: 'text-velora-sage-dark' },
              { label: t('rec.done'), value: board.stats.done, cls: 'text-velora-charcoal' },
              {
                label: t('rec.avgWait'),
                value: board.stats.avg_wait_minutes === null ? '—' : `~${board.stats.avg_wait_minutes}m`,
                cls: 'text-velora-rose-dark',
              },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-velora-ivory-300 text-center">
                <p className="text-xs text-velora-charcoal-light uppercase font-bold tracking-wider">{s.label}</p>
                <p className={`text-2xl font-serif font-bold mt-1 ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-velora-charcoal">{t('rec.lanes')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {board.barbers.map((b) => {
                const active = activeFor(b);
                const canCall = b.is_on_duty && b.status === 'AVAILABLE' && !active;
                const elapsed = active?.started_at ? minutesBetween(active.started_at, now) : 0;
                return (
                  <Card key={b.id} variant="default" padding="sm" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif font-bold text-sm text-velora-charcoal">{b.name}</span>
                      {b.is_on_duty ? (
                        <Badge status={active ? 'BUSY' : b.status} size="sm" />
                      ) : (
                        <Badge variant="neutral" label={t('rec.offDuty')} size="sm" />
                      )}
                    </div>
                    <div className="text-xs text-velora-charcoal-light space-y-1 min-h-[3rem]">
                      {active ? (
                        <>
                          <p>
                            {t('rec.nowServing')}:{' '}
                            <strong className="text-velora-charcoal">
                              {formatToken(active.daily_token)} ({active.customer_name})
                            </strong>
                          </p>
                          <p>
                            {active.status === 'CALLED'
                              ? t('rec.called')
                              : `${elapsed}m / ${active.total_duration_minutes}m`}
                          </p>
                        </>
                      ) : (
                        <p>{t('rec.idle')}</p>
                      )}
                    </div>

                    {active?.status === 'CALLED' && (
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" isLoading={busy === `start-${active.id}`} onClick={() => act(`start-${active.id}`, `/api/staff/queue/${active.id}/start`)}>
                          {t('action.startService')}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" isLoading={busy === `ns-${active.id}`} onClick={() => act(`ns-${active.id}`, `/api/staff/queue/${active.id}/no-show`)}>
                          {t('action.markNoShow')}
                        </Button>
                      </div>
                    )}
                    {active?.status === 'IN_SERVICE' && (
                      <Button size="sm" className="w-full" isLoading={busy === `fin-${active.id}`} onClick={() => act(`fin-${active.id}`, `/api/staff/queue/${active.id}/finish`)}>
                        {t('action.finishService')}
                      </Button>
                    )}
                    {!active && (
                      <Button
                        variant={canCall ? 'primary' : 'secondary'}
                        size="sm"
                        className="w-full"
                        disabled={!canCall}
                        isLoading={busy === `call-${b.id}`}
                        onClick={() => act(`call-${b.id}`, '/api/staff/queue/call-next', 'POST', { barber_id: b.id })}
                      >
                        {t('action.callNext')}
                      </Button>
                    )}

                    {!active && (
                      <div className="flex gap-2">
                        {b.is_on_duty && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            isLoading={busy === `brk-${b.id}`}
                            onClick={() =>
                              act(`brk-${b.id}`, `/api/staff/barbers/${b.id}/availability`, 'PATCH', {
                                status: b.status === 'ON_BREAK' ? 'AVAILABLE' : 'ON_BREAK',
                              })
                            }
                          >
                            {b.status === 'ON_BREAK' ? t('rec.backToWork') : t('rec.goBreak')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1"
                          isLoading={busy === `duty-${b.id}`}
                          onClick={() => act(`duty-${b.id}`, `/api/staff/barbers/${b.id}/availability`, 'PATCH', { is_on_duty: !b.is_on_duty })}
                        >
                          {b.is_on_duty ? t('rec.markOffDuty') : t('rec.markOnDuty')}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-velora-charcoal">
              {t('rec.queue')} ({waiting.length})
            </h2>
            {waiting.length === 0 ? (
              <Card variant="subtle" padding="md" className="text-sm text-velora-charcoal-light text-center">
                {t('rec.noQueue')}
              </Card>
            ) : (
              <div className="space-y-2">
                {waiting.map((e) => (
                  <Card key={e.id} variant="default" padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-serif text-2xl font-extrabold text-velora-charcoal w-16 shrink-0">{formatToken(e.daily_token)}</span>
                      <div className="min-w-0 text-xs text-velora-charcoal-light">
                        <p className="text-sm font-semibold text-velora-charcoal truncate">
                          {e.customer_name} · {e.customer_phone}
                          {e.is_walk_in && <span className="ml-2 text-[10px] uppercase text-velora-rose-dark">{t('rec.walkin')}</span>}
                        </p>
                        <p className="truncate">{svcNames(e)} · {e.total_duration_minutes}m</p>
                        <p>
                          {e.preferred_barber_name ? `${t('rec.requested')}: ${e.preferred_barber_name}` : t('rec.any')} ·{' '}
                          {e.position_ahead ?? 0} {t('rec.ahead')} ·{' '}
                          {e.estimated_wait_minutes === null ? t('track.waitUnavailable') : `~${e.estimated_wait_minutes}m`}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" isLoading={busy === `cx-${e.id}`} onClick={() => act(`cx-${e.id}`, `/api/staff/queue/${e.id}/cancel`)}>
                      {t('rec.cancelEntry')}
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const WalkinForm: React.FC<{ token: string; onClose: () => void; onDone: (msg: string) => void | Promise<void> }> = ({
  token,
  onClose,
  onDone,
}) => {
  const { t, language } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [barberId, setBarberId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Service[]>('/api/services').then(setServices).catch(() => setError(t('common.error')));
    apiFetch<Barber[]>('/api/barbers').then(setBarbers).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 3 ? [...cur, id] : cur));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ isExisting: boolean; daily_token: number }>('/api/staff/walk-in', {
        method: 'POST',
        token,
        body: {
          customer_name: name,
          customer_phone: phone,
          service_ids: selected,
          preferred_barber_id: barberId || null,
        },
      });
      await onDone(`${res.isExisting ? t('walkin.exists') : t('walkin.added')} ${`T-${String(res.daily_token).padStart(2, '0')}`}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="elevated" padding="md" className="space-y-4">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-serif text-lg font-bold text-velora-charcoal">{t('walkin.title')}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label={t('walkin.name')} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
          <Input label={t('walkin.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
        </div>
        <div className="space-y-1.5">
          <p className="block text-xs font-semibold uppercase tracking-wider text-velora-charcoal">{t('walkin.services')}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {services.map((s) => (
              <label key={s.id} className={`flex items-center gap-2 min-h-[44px] px-3 rounded-xl border text-sm cursor-pointer ${selected.includes(s.id) ? 'border-velora-rose bg-velora-ivory-100' : 'border-velora-ivory-300 bg-white'}`}>
                <input
                  type="checkbox"
                  className="accent-velora-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-velora-rose"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <span className="flex-1">{language === 'gu' ? s.name_gu : s.name_en}</span>
                <span className="text-xs text-velora-charcoal-light">{s.duration_minutes}m · ₹{Number(s.price_inr).toFixed(0)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="walkin-barber" className="block text-xs font-semibold uppercase tracking-wider text-velora-charcoal">
            {t('walkin.barber')}
          </label>
          <select
            id="walkin-barber"
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-velora-ivory-300 bg-white px-3 text-sm text-velora-charcoal focus:outline-none focus:ring-2 focus:ring-velora-rose/30 focus:border-velora-rose"
          >
            <option value="">{t('rec.any')}</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-velora-red font-medium" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" isLoading={busy} disabled={selected.length === 0}>
            {t('walkin.submit')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export const ReceptionPage: React.FC = () => (
  <StaffGate roles={['RECEPTIONIST', 'OWNER']}>{(s) => <ReceptionBoard token={s.token} />}</StaffGate>
);
