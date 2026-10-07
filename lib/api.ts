import {DEFAULT_GIFT_API_URL} from './endpoint';

export const GIFT_API_URL: string = import.meta.env.VITE_GIFT_API_URL || DEFAULT_GIFT_API_URL;

export type ApiReason = 'not_found' | 'invalid' | 'locked' | 'closed' | 'ended' | 'unavailable' | 'limit' | 'busy' | 'forbidden' | 'service' | 'network';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly reason: ApiReason) {
    super(message);
  }
}

// Apps Script cannot answer CORS preflight requests, so the body is sent as text/plain (a "simple" request).
// Apps Script always replies 200; success or failure is carried in the JSON body.
export async function callGiftApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(GIFT_API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({action, ...payload}),
      redirect: 'follow',
    });
  } catch {
    throw new ApiError('Network error', 0, 'network');
  }
  let body: {ok?: boolean; status?: number; reason?: ApiReason; error?: string; data?: T} | null = null;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(`Unexpected response (HTTP ${response.status})`, response.status, 'service');
  }
  if (!response.ok || !body || body.ok !== true) {
    throw new ApiError(body?.error || 'Request failed', body?.status ?? response.status, body?.reason ?? 'service');
  }
  return body.data as T;
}

// Catalogue "Image" values: a full HTTPS URL, or a product photo name (e.g. "hario-mug.jpg" or "hario-mug")
// that scripts/optimize-images.mjs turned into public/products/hario-mug-400.webp and -800.webp.
export function giftImage(path: string): {image: string; srcSet?: string} {
  if (!path || /^(https?:)?\/\//.test(path) || path.startsWith('data:')) return {image: path};
  const clean = path.replace(/^\/+/, '');
  if (clean.includes('/')) return {image: import.meta.env.BASE_URL + clean};
  const name = clean.replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const at = (w: number) => `${import.meta.env.BASE_URL}products/${name}-${w}.webp`;
  return {image: at(800), srcSet: `${at(400)} 400w, ${at(800)} 800w`};
}
// If a photo is missing, show the monogram instead of a broken image.
export function imageFallback(e: {currentTarget: HTMLImageElement}) {
  const img = e.currentTarget, fallback = import.meta.env.BASE_URL + 'branding/monogram.png';
  if (img.src.endsWith(fallback)) return;
  img.removeAttribute('srcset');
  img.src = fallback;
}

// The early-start request made by index.html before the app loads: the gift list and the guest's details in one trip.
type BootData = {catalogue: unknown; lookup?: unknown; lookupError?: {status: number; reason: ApiReason; error: string}};
export function takeBoot(): {code: string; data: Promise<BootData>} | null {
  const w = window as unknown as {__giftBoot?: {code: string; promise: Promise<{ok?: boolean; data?: BootData}>}};
  const boot = w.__giftBoot;
  w.__giftBoot = undefined;
  if (!boot) return null;
  // Anything unexpected (e.g. an older Apps Script without "init") falls back to the normal requests.
  return {code: boot.code, data: boot.promise.then(b => { if (!b || b.ok !== true || !b.data) throw new Error('boot unavailable'); return b.data; })};
}
