import { useEffect } from 'react';
import { Platform } from 'react-native';

// Registers /sw.js on web only: after window load, inside try/catch, so a
// failed registration can never break the app (or native).
export function WebServiceWorkerRegister() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      try {
        navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      } catch {
        // ignore: offline support is best-effort
      }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
