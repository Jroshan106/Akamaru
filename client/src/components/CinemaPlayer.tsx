import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize, SkipForward } from 'lucide-react';
import './CinemaPlayer.css';

type Props = { url: string; title: string; onNext?: () => void };
function clock(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export default function CinemaPlayer({ url, title, onNext }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const manuallyPlaying = useRef<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState('');
  const origin = new URL(url).origin;
  const supported = ['https://megaplay.buzz', 'https://megaplay.cc'].includes(origin);
  function command(cmd: string, extra = {}) {
    frame.current?.contentWindow?.postMessage({ cmd, ...extra }, origin);
  }
  function reveal() {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 3500);
  }
  useEffect(() => {
    let lastTime = 0;
    function message(event: MessageEvent) {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      let data = event.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
      if (!data || typeof data !== 'object') return;
      if (data.event === 'PLAYER_READY') { setReady(true); command('GET_TIME'); }
      if (data.event === 'CURRENT_TIME' && Number.isFinite(data.time) && Number.isFinite(data.duration)) {
        const position = Math.max(0, data.time);
        setTime(position); setDuration(Math.max(0, data.duration));
        if (data.duration > 0) { setReady(true); setSlow(false); }
        if (manuallyPlaying.current === null && position > lastTime && position - lastTime < 3) setPlaying(true);
        if (data.duration > 0 && position >= data.duration - .25) setPlaying(false);
        lastTime = position;
      }
    }
    function changed() { setFullscreen(document.fullscreenElement === shell.current); }
    window.addEventListener('message', message);
    document.addEventListener('fullscreenchange', changed);
    const poll = setInterval(() => command('GET_TIME'), 1000);
    const timeout = setTimeout(() => setSlow(true), 20000);
    return () => {
      window.removeEventListener('message', message);
      document.removeEventListener('fullscreenchange', changed);
      clearInterval(poll); clearTimeout(timeout); clearTimeout(hideTimer.current);
    };
  }, [url]);
  function toggle() { if (!ready) return; command('PLAY_TOGGLE'); manuallyPlaying.current = !playing; setPlaying(!playing); reveal(); }
  function seek(value: number) { if (!ready || !duration) return; const next = Math.min(duration, Math.max(0, value)); command('SEEK', { value: next }); setTime(next); reveal(); }
  function mute() { if (!ready) return; command('MUTE'); setMuted(value => !value); reveal(); }
  async function expand() {
    try {
      if (document.fullscreenElement === shell.current) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch { setNotice('Fullscreen is not available in this browser.'); }
  }
  if (!supported) return <div className="cinema-unavailable"><h3>This server needs its own player</h3><p>Choose an HD-1 or Vidstream-2 server to use Akamaru’s controls.</p></div>;
  return <div ref={shell} className={`cinema-player ${visible || !playing ? 'controls-visible' : ''}`}
    onPointerMove={reveal} onFocus={reveal} onKeyDown={event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      if ([' ', 'k', 'ArrowLeft', 'ArrowRight', 'm', 'f'].includes(event.key)) event.preventDefault();
      if (event.key === ' ' || event.key === 'k') toggle();
      if (event.key === 'ArrowLeft') seek(time - 10);
      if (event.key === 'ArrowRight') seek(time + 10);
      if (event.key === 'm') mute();
      if (event.key === 'f') void expand();
    }} tabIndex={0} role="region" aria-label={`${title} video player`}>
    {/* Never give the provider pointer or keyboard input: controls use its message bridge. */}
    <iframe ref={frame} src={url} title="Video source" tabIndex={-1} aria-hidden="true" className="cinema-source"
      allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
    <button className="cinema-click-surface" aria-label={playing ? 'Pause video' : 'Play video'} onClick={toggle} disabled={!ready} tabIndex={-1} />
    <div className="cinema-heading"><span>AKAMARU</span><strong>{title}</strong></div>
    {!ready && <div className="cinema-loading" role="status"><span className="cinema-spinner" /><p>{slow ? 'The video is taking longer than usual. Try another server below.' : 'Preparing your episode…'}</p></div>}
    {ready && !playing && <button className="cinema-center" onClick={toggle} aria-label="Play"><Play fill="currentColor" size={34} /></button>}
    <div className="cinema-controls" onPointerDown={reveal}>
      <input className="cinema-progress" aria-label="Seek video" type="range" min="0" max={duration || 1} step="1" value={Math.min(time, duration || 1)} disabled={!ready || !duration} onChange={e => seek(Number(e.target.value))} style={{ background: `linear-gradient(to right, #b30f3c ${duration ? time / duration * 100 : 0}%, #ffffff40 0)` }} />
      <div className="cinema-toolbar">
        <button disabled={!ready} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
        <button disabled={!ready || !duration} onClick={() => seek(time - 10)} aria-label="Back 10 seconds"><RotateCcw /><small>10</small></button>
        <button disabled={!ready || !duration} onClick={() => seek(time + 10)} aria-label="Forward 10 seconds"><RotateCw /><small>10</small></button>
        <button disabled={!ready} onClick={mute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX /> : <Volume2 />}</button>
        <span className="cinema-time">{clock(time)} / {clock(duration)}</span>
        {onNext && <button onClick={onNext} aria-label="Next episode"><SkipForward /></button>}
        <button onClick={() => void expand()} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{fullscreen ? <Minimize /> : <Maximize />}</button>
      </div>
    </div>
    {notice && <p className="cinema-notice" role="status">{notice}</p>}
  </div>;
}
