import React, { useState, useEffect } from 'react';
import type { DisplayResponse } from '@velora/shared';
import { useLanguage } from '../i18n/LanguageContext';
import { TvLayout } from '../components/layout/TvLayout';
import { apiFetch } from '../api/client';
import { useLiveResource } from '../hooks/useLiveResource';
import { formatToken } from '../utils/format';
import { Clock, Wifi, WifiOff } from 'lucide-react';

export const DisplayPage: React.FC = () => {
  const { t } = useLanguage();
  const [time, setTime] = useState<string>('');
  // Public, anonymised endpoint: token numbers and barber names only.
  const { data, connected, error } = useLiveResource<DisplayResponse>(
    () => apiFetch<DisplayResponse>('/api/display'),
    'display',
    10000
  );

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date())
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const live = connected && !error;

  return (
    <TvLayout>
      <div className="flex items-center justify-between border-b border-velora-green-light pb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-velora-copper text-white font-serif font-bold text-2xl flex items-center justify-center">
            V
          </div>
          <div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-velora-ivory tracking-tight">
              {data?.salon_name || 'Velora Salon'}
            </h1>
            <p className="text-xs uppercase tracking-widest text-velora-copper font-medium mt-0.5">
              Live Queue Display • પ્રતિક્ષા કક્ષ ડિસ્પ્લે
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-velora-ivory/80 text-sm">
          <div className="flex items-center space-x-2">
            {live ? <Wifi className="w-4 h-4 text-velora-sage animate-pulse" /> : <WifiOff className="w-4 h-4 text-velora-copper" />}
            <span className={`text-xs uppercase tracking-wider font-semibold ${live ? 'text-velora-sage' : 'text-velora-copper'}`}>
              {live ? t('track.live') : t('display.offline')}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xl font-mono font-semibold text-velora-ivory">
            <Clock className="w-5 h-5 text-velora-copper" />
            <span>{time}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-auto py-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-velora-green-light/60 pb-2">
            <h2 className="font-serif text-2xl font-bold text-velora-copper tracking-wide">
              {t('display.nowServing')} / અત્યારે સેવા
            </h2>
            <span className="text-xs text-velora-ivory/60 uppercase tracking-widest">{t('display.activeStations')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(data?.stations ?? []).map((station, i) => (
              <div
                key={station.barber_name}
                className="bg-velora-green rounded-3xl p-6 border border-velora-green-light shadow-md flex flex-col justify-between h-44"
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold text-velora-ivory/80">{station.barber_name}</span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      station.state === 'CALLED'
                        ? 'bg-velora-copper text-white animate-pulse'
                        : station.state === 'SERVING'
                        ? 'bg-velora-sage text-velora-green-dark'
                        : 'bg-velora-green-light text-velora-ivory/70'
                    }`}
                  >
                    {station.state === 'CALLED'
                      ? t('display.calledBadge')
                      : station.state === 'SERVING'
                      ? t('display.servingBadge')
                      : station.state === 'ON_BREAK'
                      ? t('display.onBreakBadge')
                      : t('display.ready')}
                  </span>
                </div>

                <div className="my-auto">
                  {station.token !== null ? (
                    <p className="font-serif font-black tracking-tight text-5xl md:text-6xl text-velora-ivory">
                      {formatToken(station.token)}
                    </p>
                  ) : (
                    <p className="font-serif font-black tracking-tight text-2xl text-velora-sage">
                      {station.state === 'ON_BREAK' ? t('display.onBreakBadge') : t('display.ready')}
                    </p>
                  )}
                </div>

                <p className="text-[11px] text-velora-ivory/50">
                  {t('display.station')} #{i + 1}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-b border-velora-green-light/60 pb-2">
            <h2 className="font-serif text-2xl font-bold text-velora-ivory tracking-wide">
              {t('display.nextInLine')} / આગળનો ક્રમ
            </h2>
            <span className="text-xs text-velora-ivory/60 uppercase tracking-widest">
              {t('display.next5')}
              {data ? ` · ${data.waiting_count} ${t('display.waitingTotal')}` : ''}
            </span>
          </div>

          <div className="space-y-2.5">
            {data && data.next.length === 0 && (
              <p className="text-sm text-velora-ivory/60 py-4">{t('display.noWaiting')}</p>
            )}
            {(data?.next ?? []).map((item, idx) => (
              <div
                key={item.token}
                className="bg-velora-green/70 rounded-2xl p-4 border border-velora-green-light/60 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-velora-copper font-serif font-bold">#{idx + 1}</span>
                  <div>
                    <span className="font-serif font-bold text-2xl text-velora-ivory">{formatToken(item.token)}</span>
                    <p className="text-[11px] text-velora-ivory/60">
                      {item.preferred_barber_name || t('display.anyBarber')}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-velora-sage">
                  {item.estimated_wait_minutes === null ? '—' : `~${item.estimated_wait_minutes}m`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-velora-green-light pt-4 flex items-center justify-between text-xs text-velora-ivory/60">
        <p>{t('display.footer')}</p>
      </div>
    </TvLayout>
  );
};
