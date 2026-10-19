import { useEffect, useState } from 'react';

export type WatchIdentity = { animeId: string; title: string; cover: string; episode: string; source: 'legacy' | 'koto' };
export type WatchEntry = WatchIdentity & { time: number; duration: number; watchedAt: number };
const key = 'akamaru-history';
let session: WatchEntry[] = [];
export function readHistory(): WatchEntry[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(data)) return data.filter((x): x is WatchEntry => x && typeof x.title === 'string' && typeof x.animeId === 'string' && typeof x.episode === 'string' && typeof x.cover === 'string' && Number.isFinite(x.time) && Number.isFinite(x.duration) && Number.isFinite(x.watchedAt) && ['legacy', 'koto'].includes(x.source)).sort((a,b) => b.watchedAt - a.watchedAt).slice(0, 200);
  } catch { /* Keep history usable for this session if storage is blocked. */ }
  return session;
}
export function recordWatch(item: WatchIdentity, time: number, duration: number) {
  if (!Number.isFinite(time) || time < 1 || !Number.isFinite(duration)) return;
  session = [{ ...item, time, duration, watchedAt: Date.now() }, ...readHistory().filter(x => !(x.animeId === item.animeId && x.episode === item.episode))].slice(0, 200);
  try { localStorage.setItem(key, JSON.stringify(session)); } catch { /* Session fallback. */ }
  window.dispatchEvent(new Event('akamaru-history-change'));
}
export function useHistory() {
  const [items, setItems] = useState(readHistory);
  useEffect(() => {
    const refresh = () => setItems(readHistory());
    window.addEventListener('storage', refresh);
    window.addEventListener('akamaru-history-change', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('akamaru-history-change', refresh); };
  }, []);
  return items;
}
