import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { WS_URL, ApiError } from '../api/client';

/**
 * Loads a resource from the API and keeps it fresh:
 *  - refetches when the server broadcasts `queue:updated` (Socket.IO),
 *  - refetches after every socket (re)connect, so a dropped connection never leaves stale data,
 *  - polls every `pollMs` and on tab focus as a fallback when websockets are blocked.
 * The server is always the source of truth; the last good data stays visible if a refresh fails.
 */
export function useLiveResource<T>(fetcher: () => Promise<T>, key: string, pollMs = 20000, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const result = await fetcherRef.current();
      if (id !== reqId.current) return; // a newer request superseded this one
      setData(result);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof ApiError ? e : new ApiError(0, 'Unexpected error'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    setData(null);
    setError(null);
    refresh();

    let debounce: number | undefined;
    const soon = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(refresh, 250);
    };

    const socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true });
    socket.on('connect', () => {
      setConnected(true);
      refresh(); // initial connect and every reconnect
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('queue:updated', soon);

    const poll = window.setInterval(refresh, pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);

    return () => {
      window.clearTimeout(debounce);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
      socket.off('queue:updated', soon);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, pollMs, refresh]);

  return { data, error, loading, connected, updatedAt, refresh };
}

/** Re-renders every `ms` so elapsed-time displays stay current. */
export function useNow(ms = 30000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
