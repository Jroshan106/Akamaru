import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import './AuthGate.css';

const Context = createContext<{ logout: () => Promise<void> }>({ logout: async () => {} });
export const useAuth = () => useContext(Context);
type Session = { authenticated: boolean; configured: boolean; expiresAt?: number };

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!cancelled) { setSession(data); setError(''); }
      } catch { if (!cancelled) setError('Could not connect to the login server. Please try again.'); }
    };
    void check();
    const timer = window.setInterval(check, 30000);
    window.addEventListener('focus', check);
    const signedOut = () => setSession(current => current ? { ...current, authenticated: false } : current);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('akamaru-auth') : null;
    if (channel) channel.onmessage = signedOut;
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', check); channel?.close(); };
  }, [attempt]);
  useEffect(() => {
    if (!session?.authenticated || !session.expiresAt) return;
    const timer = window.setTimeout(() => setSession(current => current ? { ...current, authenticated: false } : current), Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Akamaru-Request': 'auth' }, body: JSON.stringify({ username, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sign in failed. Please try again.');
      setPassword(''); setSession({ authenticated: true, configured: true, expiresAt: data.expiresAt });
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-Akamaru-Request': 'auth' } });
    if (!response.ok) throw new Error('Could not sign out. Please try again.');
    setSession({ authenticated: false, configured: true }); setPassword(''); setError('');
    if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('akamaru-auth'); channel.postMessage('logout'); channel.close(); }
  }
  if (session?.authenticated) return <Context.Provider value={{ logout }}>{children}</Context.Provider>;
  return <main className="auth-page"><section className="auth-card" aria-labelledby="login-heading">
    <img className="auth-logo" src="/akamaru-logo.png" alt="Akamaru" width="648" height="216"/>
    <span className="eyebrow"><LockKeyhole size={14}/> YOUR PRIVATE ANIME SPACE</span>
    <h1 id="login-heading">Welcome back<span className="accent">.</span></h1>
    {!session ? <><p role="status">{error ? 'The login server is unavailable.' : 'Checking your session…'}</p>{error && <><p role="alert">{error}</p><button className="button secondary" onClick={() => { setError(''); setAttempt(n => n + 1); }}>Try again</button></>}</>
      : !session.configured ? <p role="alert">Login is not configured on this server yet.</p>
      : <><p className="muted">Sign in to continue watching.</p><form onSubmit={submit}>
        <label htmlFor="login-username">Username<input id="login-username" name="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required maxLength={80}/></label>
        <label htmlFor="login-password">Password<input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={512}/></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={busy}><LogIn size={18}/>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form></>}
  </section></main>;
}
