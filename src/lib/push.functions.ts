import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

// Web Push (RFC 8291 / aes128gcm) sender for the currently signed-in user.
// Loops over every subscription that user owns and POSTs an encrypted
// payload to each push service endpoint.

interface SendInput {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
}

interface PushSubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function b64UrlToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/g, '');
  const b64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const saltBytes = salt.length > 0 ? salt : new Uint8Array(32);
  const saltKey = await crypto.subtle.importKey('raw', toArrayBuffer(saltBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, toArrayBuffer(ikm)));
  const prkKey = await crypto.subtle.importKey('raw', toArrayBuffer(prk), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hashLen = 32;
  const n = Math.ceil(length / hashLen);
  let t = new Uint8Array(0);
  const okm = new Uint8Array(n * hashLen);
  for (let i = 0; i < n; i++) {
    const inp = new Uint8Array(t.length + info.length + 1);
    inp.set(t, 0);
    inp.set(info, t.length);
    inp[inp.length - 1] = i + 1;
    t = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, toArrayBuffer(inp)));
    okm.set(t, i * hashLen);
  }
  return okm.slice(0, length);
}

async function generateVapidJWT(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud, exp: now + 12 * 60 * 60, sub: subject };

  const headerB64 = bytesToB64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = bytesToB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const pubBytes = b64UrlToBytes(vapidPublicKey);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidPrivateKey,
    x: bytesToB64Url(pubBytes.slice(1, 33)),
    y: bytesToB64Url(pubBytes.slice(33, 65)),
    ext: true,
  };

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${bytesToB64Url(sig)}`;
}

async function encryptPayload(
  payload: string,
  subscriberPublicKey: Uint8Array,
  subscriberAuth: Uint8Array,
): Promise<Uint8Array> {
  // 1) Server ECDH ephemeral keypair
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(subscriberPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, serverKeyPair.privateKey, 256),
  );

  // 2) Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 3) IKM (RFC 8291)
  const keyInfoPrefix = new TextEncoder().encode('WebPush: info\0');
  const keyInfo = new Uint8Array(keyInfoPrefix.length + subscriberPublicKey.length + serverPublicKey.length);
  keyInfo.set(keyInfoPrefix, 0);
  keyInfo.set(subscriberPublicKey, keyInfoPrefix.length);
  keyInfo.set(serverPublicKey, keyInfoPrefix.length + subscriberPublicKey.length);
  const ikm = await hkdf(subscriberAuth, sharedSecret, keyInfo, 32);

  // 4) CEK + nonce (aes128gcm: no context bytes)
  const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  // 5) Pad payload (delimiter 0x02 = last record)
  const pl = new TextEncoder().encode(payload);
  const padded = new Uint8Array(pl.length + 1);
  padded.set(pl);
  padded[pl.length] = 2;

  // 6) AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', toArrayBuffer(cek), { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce) }, aesKey, toArrayBuffer(padded)));

  // 7) aes128gcm record header (RFC 8188): salt(16) | rs(4) | idlen(1) | keyid | ciphertext
  const rs = 4096;
  const out = new Uint8Array(16 + 4 + 1 + serverPublicKey.length + ct.length);
  let o = 0;
  out.set(salt, o); o += 16;
  out[o++] = (rs >>> 24) & 0xff;
  out[o++] = (rs >>> 16) & 0xff;
  out[o++] = (rs >>> 8) & 0xff;
  out[o++] = rs & 0xff;
  out[o++] = serverPublicKey.length;
  out.set(serverPublicKey, o); o += serverPublicKey.length;
  out.set(ct, o);
  return out;
}

export const sendPushToSelf = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendInput) => input)
  .handler(async ({ data, context }) => {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY ||
      'BDkC7QUwB0PLYU3Go24FEBGER2FTvqkBZIcExhsymEny5yBDPtNmrkyxGwU3NZ0N_ikK_pGa7quP3vhC2kTW3lU';
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:tradevault@outlook.fr';
    if (!vapidPrivate) throw new Error('VAPID_PRIVATE_KEY not configured');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', context.userId);
    if (error) throw error;
    const subscriptions = (subs ?? []) as PushSubRow[];
    if (subscriptions.length === 0) return { sent: 0, total: 0 };

    const body = JSON.stringify({
      title: data.title || 'TradeVault',
      body: data.body || 'You have a new notification',
      url: data.url || '/',
      icon: data.icon || '/icon-512.png',
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        const pub = b64UrlToBytes(sub.p256dh);
        const auth = b64UrlToBytes(sub.auth);
        const encrypted = await encryptPayload(body, pub, auth);
        const jwt = await generateVapidJWT(sub.endpoint, vapidPublic, vapidPrivate, subject);

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'Content-Length': encrypted.length.toString(),
            TTL: '86400',
            Authorization: `vapid t=${jwt}, k=${vapidPublic}`,
          },
          body: toArrayBuffer(encrypted),
        });

        if (res.ok || res.status === 201) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          // Subscription gone — prune it. RLS allows this: the subscription belongs
          // to the currently authenticated user (context.userId), so no service-role
          // client is needed here.
          await sb.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          const text = await res.text().catch(() => '');
          console.error('[push] send failed', res.status, text);
        }
      } catch (e) {
        console.error('[push] error sending to subscription', e);
      }
    }

    return { sent, total: subscriptions.length };
  });