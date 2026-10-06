// Google Apps Script web app (setup/Code.gs). Redeploy as a new version of the same deployment to keep this URL.
export const GIFT_API_URL: string =
  import.meta.env.VITE_GIFT_API_URL ||
  'https://script.google.com/macros/s/AKfycbx-K_3VArxV25Jkv_ecefRr_23Fp3FEZpqUw2zhQr-IWNeyb3oYI-1wXBajKFQtwGAj/exec';

export type ApiReason = 'not_found' | 'invalid' | 'locked' | 'closed' | 'ended' | 'unavailable' | 'busy' | 'forbidden' | 'service' | 'network';

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
    throw new ApiError('Unexpected response', response.status, 'service');
  }
  if (!response.ok || !body || body.ok !== true) {
    throw new ApiError(body?.error || 'Request failed', body?.status ?? response.status, body?.reason ?? 'service');
  }
  return body.data as T;
}

// Catalogue images may be full HTTPS URLs or file names stored in public/products/.
export function assetUrl(path: string): string {
  if (!path || /^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  const clean = path.replace(/^\/+/, '');
  return import.meta.env.BASE_URL + (clean.includes('/') ? clean : 'products/' + clean);
}
