// Remembers the gift list and the guest's own page on this device, so return visits show instantly
// while fresh data loads in the background. Every read/write is optional: private browsing or blocked
// storage simply means no shortcut.
const CATALOGUE_KEY = 'gift-catalogue-v1';
const GUEST_PREFIX = 'gift-guest-v1-';
const MAX_AGE = 30 * 24 * 3600 * 1000;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const {at, data} = JSON.parse(raw) as {at: number; data: T};
    if (Date.now() - at > MAX_AGE) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}
function write(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify({at: Date.now(), data})); } catch { /* storage full or blocked */ }
}

export const readCatalogue = <T>() => read<T>(CATALOGUE_KEY);
export const writeCatalogue = (data: unknown) => write(CATALOGUE_KEY, data);

// The guest's code is never stored in plain text: the entry is named by a hash of it.
async function guestKey(code: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('htoo-may:' + code));
    return GUEST_PREFIX + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch { return null; }
}
export async function readGuest<T>(code: string): Promise<T | null> { const key = await guestKey(code); return key ? read<T>(key) : null; }
export async function writeGuest(code: string, data: unknown) { const key = await guestKey(code); if (key) write(key, data); }
export async function forgetGuest(code: string) { const key = await guestKey(code); try { if (key) localStorage.removeItem(key); } catch { /* ignore */ } }
