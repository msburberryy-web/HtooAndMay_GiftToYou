// Google Apps Script web app (setup/Code.gs). Redeploy as a new version of the same deployment to keep this URL.
export const GIFT_API_URL: string =
  import.meta.env.VITE_GIFT_API_URL ||
  'https://script.google.com/macros/s/AKfycbx-K_3VArxV25Jkv_ecefRr_23Fp3FEZpqUw2zhQr-IWNeyb3oYI-1wXBajKFQtwGAj/exec';

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
