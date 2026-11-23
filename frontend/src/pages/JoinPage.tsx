import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { INDIAN_PHONE_REGEX } from '@velora/shared';
import type { Barber, JoinQueueResponse, PublicSalonSummary, Service } from '@velora/shared';
import { apiFetch } from '../api/client';
import { useLiveResource } from '../hooks/useLiveResource';
import {
  User,
  Phone,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Info,
  Sparkles,
  Users,
  Clock,
  RefreshCw,
  WifiOff,
} from 'lucide-react';

export const JoinPage: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const {
    data: queuePreview,
    error: queuePreviewError,
    loading: queuePreviewLoading,
    connected: queuePreviewConnected,
    refresh: refreshQueuePreview,
  } = useLiveResource<PublicSalonSummary>(
    () => apiFetch<PublicSalonSummary>('/api/salon/status'),
    'join-queue-preview'
  );

  // Wizard Step (1: Details, 2: Services, 3: Barber, 4: Confirm)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [preferredBarberId, setPreferredBarberId] = useState<string | null>(null);

  // Loaded Catalog Data
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Form Errors & Submission State
  const [errors, setErrors] = useState<{ name?: string; phone?: string; services?: string }>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingData(true);
      try {
        const [servicesRes, barbersRes] = await Promise.all([
          fetch(`${apiUrl}/api/services`),
          fetch(`${apiUrl}/api/barbers`),
        ]);
        if (servicesRes.ok && barbersRes.ok) {
          const servicesJson = await servicesRes.json();
          const barbersJson = await barbersRes.json();
          setServices(servicesJson);
          setBarbers(barbersJson);
        }
      } catch (err) {
        console.warn('Failed to load live catalog, using fallback');
      } finally {
        setLoadingData(false);
      }
    };
    loadCatalog();
  }, [apiUrl]);

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const newErrors: { name?: string; phone?: string } = {};
    if (!name.trim() || name.trim().length < 2 || name.trim().length > 60) {
      newErrors.name = t('join.nameError');
    }
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!cleanPhone || !INDIAN_PHONE_REGEX.test(cleanPhone)) {
      newErrors.phone = t('join.phoneError');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const newErrors: { services?: string } = {};
    if (selectedServiceIds.length === 0) {
      newErrors.services = t('join.noServicesError');
    } else if (selectedServiceIds.length > 3) {
      newErrors.services = t('join.maxServicesError');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const toggleService = (serviceId: string) => {
    setErrors((prev) => ({ ...prev, services: undefined }));
    if (selectedServiceIds.includes(serviceId)) {
      setSelectedServiceIds(selectedServiceIds.filter((id) => id !== serviceId));
    } else {
      if (selectedServiceIds.length >= 3) {
        setErrors((prev) => ({ ...prev, services: t('join.maxServicesError') }));
        return;
      }
      setSelectedServiceIds([...selectedServiceIds, serviceId]);
    }
  };

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price_inr), 0);
  const selectedBarber = barbers.find((b) => b.id === preferredBarberId);

  // Submit Queue Entry
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setDuplicateNotice(null);

    try {
      const payload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        service_ids: selectedServiceIds,
        preferred_barber_id: preferredBarberId || null,
        is_walk_in: false,
      };

      const res = await fetch(`${apiUrl}/api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: JoinQueueResponse = await res.json();

      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to secure queue token');
      }

      if (data.isExisting) {
        setDuplicateNotice(t('join.duplicateNotice'));
        setTimeout(() => {
          navigate(`/status/${data.entry.public_id}`);
        }, 1500);
      } else {
        navigate(`/status/${data.entry.public_id}`);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="text-center space-y-1">
        <h1 className="font-serif text-3xl font-bold text-velora-charcoal">{t('join.title')}</h1>
        <p className="text-xs sm:text-sm text-velora-charcoal-light">{t('join.subtitle')}</p>
      </div>

      <Card
        variant="subtle"
        padding="sm"
        className="space-y-3 border-velora-rose/30"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-velora-gold-dark" />
            <h2 className="font-serif text-base font-semibold text-velora-charcoal">
              {t('join.livePreview')}
            </h2>
          </div>
          {queuePreview && !queuePreviewConnected && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-velora-amber">
              <WifiOff className="h-3 w-3" />
              {t('track.reconnecting')}
            </span>
          )}
        </div>

        {queuePreviewLoading && !queuePreview ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : queuePreview ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-velora-ivory-200 bg-white p-3">
                <div className="mb-1 flex items-center gap-1.5 text-velora-gold-dark">
                  <Users className="h-4 w-4" />
                  <p className="text-xs font-medium text-velora-charcoal-light">
                    {t('join.peopleWaiting')}
                  </p>
                </div>
                <p className="font-serif text-2xl font-bold text-velora-burgundy">
                  {queuePreview.stats.waitingCount}
                </p>
              </div>
              <div className="rounded-xl border border-velora-ivory-200 bg-white p-3">
                <div className="mb-1 flex items-center gap-1.5 text-velora-gold-dark">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs font-medium text-velora-charcoal-light">
                    {t('join.estWait')}
                  </p>
                </div>
                <p className="font-serif text-lg font-bold text-velora-rose-dark">
                  {queuePreview.stats.approxWaitMinutes === null
                    ? t('track.waitUnavailable')
                    : `${queuePreview.stats.approxWaitMinutes} ${t('common.minutes')}`}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-velora-charcoal-light">
              {t('join.estWaitDisclaimer')}
            </p>
            {queuePreviewError && (
              <div
                className="flex flex-col gap-2 text-xs text-velora-red sm:flex-row sm:items-center sm:justify-between"
                role="alert"
              >
                <span>{t('join.previewRefreshError')}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={refreshQueuePreview}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  {t('common.retry')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2 text-xs text-velora-charcoal-light sm:flex-row sm:items-center sm:justify-between">
            <p role="status">{t('join.previewUnavailable')}</p>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={refreshQueuePreview}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              {t('common.retry')}
            </Button>
          </div>
        )}
      </Card>

      {/* Step Indicator */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          { num: 1, label: t('join.step1') },
          { num: 2, label: t('join.step2') },
          { num: 3, label: t('join.step3') },
          { num: 4, label: t('join.step4') },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-2 sm:p-2.5 rounded-xl border text-center transition-colors ${
              step === s.num
                ? 'bg-velora-burgundy text-white border-velora-burgundy shadow-sm'
                : step > s.num
                ? 'bg-velora-sage-light text-velora-sage-dark border-velora-sage/30'
                : 'bg-white border-velora-ivory-300 text-velora-charcoal-light'
            }`}
          >
            <p className="font-serif font-bold text-xs">{s.num}</p>
            <p className="text-[10px] truncate font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Duplicate Token Notification Banner */}
      {duplicateNotice && (
        <Card variant="subtle" padding="md" className="border-velora-amber bg-velora-amber-light/70 text-velora-amber flex items-center space-x-3 animate-pulse">
          <Info className="w-5 h-5 shrink-0" />
          <p className="text-xs sm:text-sm font-semibold">{duplicateNotice}</p>
        </Card>
      )}

      {/* Submit Error Banner */}
      {submitError && (
        <Card variant="subtle" padding="md" className="border-velora-red/30 bg-velora-red-light/50 text-velora-red flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs sm:text-sm font-semibold">{submitError}</p>
        </Card>
      )}

      {/* Main Wizard Form Card */}
      <Card variant="default" padding="lg" className="space-y-6">
        {/* STEP 1: Details */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in-50">
            <div>
              <h2 className="font-serif text-lg font-bold text-velora-charcoal">{t('join.step1')}</h2>
              <p className="text-xs text-velora-charcoal-light">Please provide your name and Indian mobile number</p>
            </div>

            <div className="space-y-4">
              <Input
                label={t('join.name')}
                placeholder={t('join.namePlaceholder')}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                error={errors.name}
                leftIcon={<User className="w-4 h-4" />}
                autoFocus
              />

              <Input
                label={t('join.phone')}
                placeholder={t('join.phonePlaceholder')}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                error={errors.phone}
                helperText={t('join.phoneHelper')}
                leftIcon={<Phone className="w-4 h-4" />}
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button variant="primary" size="md" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
                {t('join.nextStep')}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Services */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-velora-charcoal">{t('join.step2')}</h2>
                <p className="text-xs text-velora-charcoal-light">{t('join.selectServices')}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-velora-ivory-200 text-velora-charcoal">
                Selected: {selectedServiceIds.length} / 3
              </span>
            </div>

            {errors.services && (
              <p className="text-xs text-velora-red font-medium">{errors.services}</p>
            )}

            {loadingData ? (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {services.map((service) => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all select-none ${
                        isSelected
                          ? 'border-velora-rose bg-velora-rose-light/60 shadow-sm'
                          : 'border-velora-ivory-300 bg-white hover:bg-velora-ivory-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-velora-rose border-velora-rose text-white'
                              : 'border-velora-charcoal/30 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <p className="font-serif font-semibold text-sm text-velora-charcoal">
                            {language === 'gu' ? service.name_gu : service.name_en}
                          </p>
                          <p className="text-xs text-velora-charcoal-light">
                            {language === 'gu' ? service.name_en : service.name_gu} • {service.duration_minutes}m
                          </p>
                        </div>
                      </div>
                      <span className="font-serif font-bold text-velora-rose-dark text-sm">
                        ₹{Number(service.price_inr).toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 flex justify-between">
              <Button variant="secondary" size="md" onClick={() => setStep(1)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                {t('join.prevStep')}
              </Button>
              <Button variant="primary" size="md" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
                {t('join.nextStep')}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Barber Preference */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in-50">
            <div>
              <h2 className="font-serif text-lg font-bold text-velora-charcoal">{t('join.step3')}</h2>
              <p className="text-xs text-velora-charcoal-light">Pick a specific specialist or choose Any Available Barber</p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Any Available Barber (Recommended) */}
              <div
                onClick={() => setPreferredBarberId(null)}
                className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all select-none ${
                  preferredBarberId === null
                    ? 'border-velora-rose bg-velora-rose-light/60 shadow-sm'
                    : 'border-velora-ivory-300 bg-white hover:bg-velora-ivory-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      preferredBarberId === null
                        ? 'bg-velora-rose border-velora-rose text-white'
                        : 'border-velora-charcoal/30 bg-white'
                    }`}
                  >
                    {preferredBarberId === null && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-serif font-bold text-sm text-velora-charcoal">
                        {t('join.anyBarber')}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-velora-sage-light text-velora-sage-dark">
                        {t('join.recommended')}
                      </span>
                    </div>
                    <p className="text-xs text-velora-charcoal-light">{t('join.anyBarberDesc')}</p>
                  </div>
                </div>
              </div>

              {/* Individual Barbers */}
              {barbers.map((barber) => {
                const isSelected = preferredBarberId === barber.id;
                return (
                  <div
                    key={barber.id}
                    onClick={() => setPreferredBarberId(barber.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all select-none ${
                      isSelected
                        ? 'border-velora-rose bg-velora-rose-light/60 shadow-sm'
                        : 'border-velora-ivory-300 bg-white hover:bg-velora-ivory-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-velora-rose border-velora-rose text-white'
                            : 'border-velora-charcoal/30 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <p className="font-serif font-semibold text-sm text-velora-charcoal">{barber.name}</p>
                        <p className="text-xs text-velora-charcoal-light">{barber.speciality || 'Stylist'}</p>
                      </div>
                    </div>
                    <Badge status={barber.status} size="sm" />
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-between">
              <Button variant="secondary" size="md" onClick={() => setStep(2)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                {t('join.prevStep')}
              </Button>
              <Button variant="primary" size="md" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
                {t('join.nextStep')}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmation Summary */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in-50">
            <div>
              <h2 className="font-serif text-lg font-bold text-velora-charcoal">{t('join.summaryTitle')}</h2>
              <p className="text-xs text-velora-charcoal-light">Verify your information before receiving your token</p>
            </div>

            {/* Customer Details Box */}
            <div className="p-4 rounded-xl bg-velora-ivory-100 border border-velora-ivory-200 text-xs space-y-1">
              <p className="text-velora-charcoal font-semibold text-sm">{name}</p>
              <p className="text-velora-charcoal-light font-mono">{phone}</p>
              <p className="text-velora-charcoal-light pt-1">
                Barber Preference:{' '}
                <strong className="text-velora-charcoal">
                  {selectedBarber ? selectedBarber.name : t('join.anyBarber')}
                </strong>
              </p>
            </div>

            {/* Selected Services Itemized */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider font-bold text-velora-charcoal-light">
                Selected Services ({selectedServices.length})
              </p>
              <div className="space-y-1.5">
                {selectedServices.map((service) => (
                  <div key={service.id} className="flex justify-between items-center text-xs py-1 border-b border-velora-ivory-200">
                    <span className="text-velora-charcoal font-medium">
                      {language === 'gu' ? service.name_gu : service.name_en} ({service.duration_minutes}m)
                    </span>
                    <span className="font-serif font-bold text-velora-rose-dark">
                      ₹{Number(service.price_inr).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Strip */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-velora-burgundy text-white">
              <div>
                <p className="text-[11px] text-velora-ivory/70 uppercase tracking-wider">{t('join.totalDuration')}</p>
                <p className="font-serif text-xl font-bold">{totalDuration} min</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-velora-ivory/70 uppercase tracking-wider">{t('join.totalPrice')}</p>
                <p className="font-serif text-xl font-bold text-velora-rose-dark">₹{totalPrice.toFixed(0)}</p>
              </div>
            </div>

            {/* Privacy Consent */}
            <p className="text-[11px] text-velora-charcoal-light leading-relaxed bg-velora-ivory-100 p-3 rounded-xl border border-velora-ivory-200">
              {t('join.consent')}
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <Button variant="secondary" size="md" onClick={() => setStep(3)} leftIcon={<ArrowLeft className="w-4 h-4" />} disabled={submitting}>
                {t('join.prevStep')}
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleSubmit}
                isLoading={submitting}
                rightIcon={<Sparkles className="w-4 h-4" />}
              >
                {submitting ? t('join.submitting') : t('join.submitBtn')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
