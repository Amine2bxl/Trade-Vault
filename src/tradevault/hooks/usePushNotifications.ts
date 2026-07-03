import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// VAPID public key — safe to expose to the browser.
export const VAPID_PUBLIC_KEY =
  'BDkC7QUwB0PLYU3Go24FEBGER2FTvqkBZIcExhsymEny5yBDPtNmrkyxGwU3NZ0N_ikK_pGa7quP3vhC2kTW3lU';

const SW_URL = '/sw-push.js';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [isiOS, setIsiOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsiOS(iOSDevice);
    setIsPWA(standalone);

    const hasSW = 'serviceWorker' in navigator;
    const hasPM = 'PushManager' in window;
    const hasN = 'Notification' in window;
    // iOS only supports web push when installed to home screen.
    setIsSupported(hasSW && hasPM && hasN && (!iOSDevice || standalone));

    if (hasN) setPermission(Notification.permission);

    (async () => {
      try {
        if (!hasSW) return;
        const reg = await navigator.serviceWorker.getRegistration(SW_URL);
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch {
        /* noop */
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) throw new Error('Push notifications are not supported on this device');
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Notification permission denied');

      const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
      await navigator.serviceWorker.ready;

      const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      });

      const p256dh = bufferToBase64(sub.getKey('p256dh'));
      const auth = bufferToBase64(sub.getKey('auth'));
      if (!p256dh || !auth) throw new Error('Failed to read push subscription keys');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      }, { onConflict: 'user_id,endpoint' });
      if (error) throw error;

      setIsSubscribed(true);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      if (!reg) { setIsSubscribed(false); return; }
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint);
        }
      }
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, permission, isLoading, isiOS, isPWA, subscribe, unsubscribe };
}