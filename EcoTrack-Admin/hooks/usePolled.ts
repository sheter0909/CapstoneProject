'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PolledState<T> {
  data: T | null;
  isLoading: boolean;
  /** True when a background refresh is in-flight (data already present). */
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  /** Immediately trigger a background refetch (use after mutations). */
  refetch: () => void;
}

/**
 * Polls `fetchFn` on mount and every `intervalMs` milliseconds.
 *
 * - Skips the interval tick when `document.hidden` (tab in background).
 * - Immediately refetches on tab-visible, window focus, and browser online.
 * - `refetch()` triggers an immediate re-fetch and resets the timer so the
 *   next automatic tick is a full `intervalMs` away (no double-fetch).
 * - `enabled` pauses all activity until auth is confirmed.
 */
export function usePolled<T>(
  fetchFn: () => Promise<T>,
  options: { intervalMs?: number; enabled?: boolean } = {},
): PolledState<T> {
  const { intervalMs = 10_000, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Incrementing version causes the useEffect to re-run → immediate refetch.
  const [version, setVersion] = useState(0);

  // Always call the latest fetchFn without re-creating the interval.
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const doFetch = async (background: boolean) => {
      if (cancelled) return;
      if (background) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const result = await fetchRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        // On background refreshes keep showing stale data; surface the error
        // only on the very first load when there is nothing to display yet.
        if (!cancelled && !background) {
          setError(err instanceof Error ? err.message : 'Failed to load data.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void doFetch(false);

    const tick = () => {
      if (typeof document === 'undefined' || !document.hidden) void doFetch(true);
    };
    const intervalId = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) void doFetch(true);
    };
    const onFocus = () => void doFetch(true);
    const onOnline = () => void doFetch(true);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      window.addEventListener('online', onOnline);
    }

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('online', onOnline);
      }
    };
  // version is intentionally a dep so refetch() re-runs the effect.
  }, [enabled, intervalMs, version]);

  return { data, isLoading, isRefreshing, error, lastUpdated, refetch };
}
