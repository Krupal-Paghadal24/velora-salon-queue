import React, { useEffect, useState } from 'react';
import type { AdminSettingsResponse } from '@velora/shared';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { StaffGate } from '../auth/StaffAuth';
import { apiFetch, ApiError } from '../api/client';
import { useLiveResource } from '../hooks/useLiveResource';
import { Settings, Users, Clock } from 'lucide-react';

type Tab = 'hours' | 'services' | 'barbers';

const AdminConsole: React.FC<{ token: string }> = ({ token }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('hours');
  const { data, error, loading, refresh } = useLiveResource<AdminSettingsResponse>(
    () => apiFetch<AdminSettingsResponse>('/api/admin/settings', { token }),
    'admin',
    60000
  );

  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [cutoff, setCutoff] = useState('30');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Sync form fields from the server whenever settings change (never from local state alone).
  const s = data?.settings;
  useEffect(() => {
    if (s) {
      setOpening(s.opening_time.slice(0, 5));
      setClosing(s.closing_time.slice(0, 5));
      setCutoff(String(s.online_cutoff_minutes));
    }
  }, [s?.opening_time, s?.closing_time, s?.online_cutoff_minutes]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, path: string, method: string, body: unknown, okText = t('admin.saved')) => {
    setBusy(key);
    setNotice(null);
    try {
      await apiFetch(path, { method, body, token });
      setNotice({ kind: 'ok', text: okText });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof ApiError ? e.message : t('common.error') });
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Settings }> = [
    { id: 'hours', label: t('admin.hours'), icon: Clock },
    { id: 'services', label: t('admin.services'), icon: Settings },
    { id: 'barbers', label: t('admin.barbers'), icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-velora-ivory-300 pb-4">
        <div className="flex items-center space-x-2">
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-velora-green">{t('admin.title')}</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-velora-copper text-white">Owner</span>
        </div>
        <p className="text-xs text-velora-green/70">{t('admin.subtitle')}</p>
      </div>

      <div className="flex space-x-1 border-b border-velora-ivory-300 pb-px overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
                activeTab === tab.id
                  ? 'border-velora-green text-velora-green bg-white'
                  : 'border-transparent text-velora-green/60 hover:text-velora-green hover:bg-velora-ivory-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-xl text-xs font-medium border ${
            notice.kind === 'error' ? 'bg-white border-velora-red/40 text-velora-red' : 'bg-velora-ivory-100 border-velora-ivory-200 text-velora-green'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && !data && <Skeleton className="h-48 rounded-2xl" />}
      {error && !data && (
        <Card variant="subtle" padding="md" className="text-sm text-velora-red flex items-center justify-between gap-3">
          <span>{error.message}</span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            {t('common.retry')}
          </Button>
        </Card>
      )}

      {data && activeTab === 'hours' && (
        <Card variant="default" padding="lg" className="space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-velora-green">{t('admin.joining')}</h2>
              <p className="text-xs text-velora-green/70">{t('admin.joiningDesc')}</p>
            </div>
            <Button
              variant={data.settings.is_online_joining_enabled ? 'primary' : 'secondary'}
              isLoading={busy === 'joining'}
              onClick={() => run('joining', '/api/admin/settings', 'PATCH', { is_online_joining_enabled: !data.settings.is_online_joining_enabled })}
              aria-pressed={data.settings.is_online_joining_enabled}
            >
              {data.settings.is_online_joining_enabled ? t('admin.on') : t('admin.off')}
            </Button>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run('hours', '/api/admin/settings', 'PATCH', {
                opening_time: opening,
                closing_time: closing,
                online_cutoff_minutes: Number(cutoff),
              });
            }}
          >
            <h2 className="font-serif text-lg font-bold text-velora-green">{t('admin.hours')}</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label={t('admin.opening')} type="time" value={opening} onChange={(e) => setOpening(e.target.value)} required />
              <Input label={t('admin.closing')} type="time" value={closing} onChange={(e) => setClosing(e.target.value)} required />
              <Input label={t('admin.cutoff')} type="number" min={0} max={240} value={cutoff} onChange={(e) => setCutoff(e.target.value)} required />
            </div>
            <Button type="submit" variant="copper" isLoading={busy === 'hours'}>
              {t('admin.saveHours')}
            </Button>
          </form>
        </Card>
      )}

      {data && activeTab === 'services' && (
        <Card variant="default" padding="lg" className="space-y-4">
          <p className="text-xs text-velora-green/70">{t('admin.servicesDesc')}</p>
          <div className="space-y-2">
            {data.services.map((svc) => (
              <div key={svc.id} className="flex items-center justify-between gap-3 border border-velora-ivory-200 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-velora-green truncate">{language === 'gu' ? svc.name_gu : svc.name_en}</p>
                  <p className="text-xs text-velora-green/60">
                    {svc.duration_minutes} {t('common.minutes')} · ₹{Number(svc.price_inr).toFixed(0)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={svc.is_enabled ? 'primary' : 'secondary'}
                  isLoading={busy === `svc-${svc.id}`}
                  onClick={() => run(`svc-${svc.id}`, `/api/admin/services/${svc.id}`, 'PATCH', { is_enabled: !svc.is_enabled })}
                >
                  {svc.is_enabled ? t('admin.enabled') : t('admin.disabled')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data && activeTab === 'barbers' && (
        <Card variant="default" padding="lg" className="space-y-4">
          <p className="text-xs text-velora-green/70">{t('admin.barbersDesc')}</p>
          <div className="space-y-2">
            {data.barbers.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 border border-velora-ivory-200 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-velora-green truncate">{b.name}</p>
                  <p className="text-xs text-velora-green/60 truncate">{b.speciality}</p>
                </div>
                <Button
                  size="sm"
                  variant={b.is_on_duty ? 'primary' : 'secondary'}
                  disabled={Boolean(b.active_entry_id)}
                  isLoading={busy === `barber-${b.id}`}
                  onClick={() => run(`barber-${b.id}`, `/api/staff/barbers/${b.id}/availability`, 'PATCH', { is_on_duty: !b.is_on_duty })}
                >
                  {b.is_on_duty ? t('admin.onDuty') : t('admin.offDuty')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export const AdminPage: React.FC = () => (
  <StaffGate roles={['OWNER']}>{(s) => <AdminConsole token={s.token} />}</StaffGate>
);
