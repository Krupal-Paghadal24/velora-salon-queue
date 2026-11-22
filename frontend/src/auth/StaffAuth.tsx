import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { LoginResponse, StaffRole, StaffUserPublic } from '@velora/shared';
import { Lock, LogOut } from 'lucide-react';
import { apiFetch, ApiError } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface Session {
  token: string;
  user: StaffUserPublic;
}

interface StaffAuthContextType {
  session: Session | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'velora_staff_session';
const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Holds only the signed token for this browser tab. All business data stays on the server. */
export const StaffAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(loadSession);

  const logout = useCallback(() => {
    setSession(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiFetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { username, password } });
    const next = { token: res.token, user: res.user };
    setSession(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    window.addEventListener('velora:unauthorized', logout);
    return () => window.removeEventListener('velora:unauthorized', logout);
  }, [logout]);

  return <StaffAuthContext.Provider value={{ session, login, logout }}>{children}</StaffAuthContext.Provider>;
};

export const useStaffAuth = (): StaffAuthContextType => {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return ctx;
};

/** Renders children only for a signed-in user with an allowed role; otherwise shows the login form. */
export const StaffGate: React.FC<{
  roles: StaffRole[];
  children: (session: Session) => React.ReactNode;
}> = ({ roles, children }) => {
  const { session, login, logout } = useStaffAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && roles.includes(session.user.role)) {
    return (
      <>
        <div className="flex justify-end items-center gap-3 text-xs text-velora-green/70 mb-4">
          <span>
            {t('common.signedInAs')} <strong className="text-velora-green">{session.user.full_name}</strong>
          </span>
          <Button variant="ghost" size="sm" leftIcon={<LogOut className="w-3.5 h-3.5" />} onClick={logout}>
            {t('common.signOut')}
          </Button>
        </div>
        {children(session)}
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto py-8">
      <Card variant="elevated" padding="lg" className="space-y-5">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-velora-ivory-200 flex items-center justify-center text-velora-green/70">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="font-serif text-xl font-bold text-velora-green">{t('login.title')}</h1>
          <p className="text-xs text-velora-green/70">{t('login.subtitle')}</p>
        </div>

        {session && !roles.includes(session.user.role) && (
          <div className="p-3 rounded-xl bg-velora-ivory-100 border border-velora-ivory-200 text-xs text-velora-green/80 flex items-center justify-between gap-2">
            <span>{t('login.wrongRole')}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              {t('common.signOut')}
            </Button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Input
            label={t('login.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          <Input
            label={t('login.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="text-xs text-velora-red font-medium" role="alert">{error}</p>}
          <Button type="submit" className="w-full" isLoading={busy}>
            {t('login.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
};
