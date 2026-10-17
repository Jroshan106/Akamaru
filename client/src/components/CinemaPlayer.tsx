import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize, SkipForward, Settings, Captions, Monitor, X } from 'lucide-react';
import './CinemaPlayer.css';
import type Hls from 'hls.js';

export type SubtitleTrack = { url: string; label: string; default?: boolean };
type Props = { url: string; title: string; intro?: [number, number] | null; outro?: [number, number] | null; onNext?: () => void; direct?: boolean; tracks?: SubtitleTrack[]; autoStart?: boolean };

function toProxiedUrl(rawUrl: string): string {
  if (rawUrl.startsWith('https://og.bakayaro.live/m3u8/')) {
    return rawUrl.replace('https://og.bakayaro.live/m3u8/', '/api/anikage/media/m3u8/');
  }
  return rawUrl;
}

function toProxiedTrackUrl(rawUrl: string): string {
  if (rawUrl.startsWith('https://og.bakayaro.live/stream/')) {
    return rawUrl.replace('https://og.bakayaro.live/stream/', '/api/anikage/media/subtitles/');
  }
  return rawUrl;
}

function preference(key: string, defaultValue = true) {
  try {
    const val = localStorage.getItem(key);
    return val === null ? defaultValue : val === 'true';
  } catch {
    return defaultValue;
  }
}

function clock(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function CinemaPlayer({ url, title, intro, outro, onNext, direct = false, tracks = [], autoStart = false }: Props) {
  const playbackUrl = direct ? toProxiedUrl(url) : url;
  const proxiedTracks = tracks.map(t => ({ ...t, url: toProxiedTrackUrl(t.url) }));

  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const [qualities, setQualities] = useState<{ id: number; height: number; bitrate: number; label: string }[]>([]);
  const [quality, setQuality] = useState(-1);
  const [caption, setCaption] = useState(-1);
  const [speed, setSpeed] = useState(() => {
    try {
      const s = Number(localStorage.getItem('akamaru-playback-speed'));
      return Number.isFinite(s) && s >= .5 && s <= 3 ? s : 1;
    } catch { return 1; }
  });
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
  const [menu, setMenu] = useState<'settings' | 'subtitles' | 'quality' | null>(null);
  const [autoNext, setAutoNext] = useState(() => preference('akamaru-auto-next', true));
  const [autoIntro, setAutoIntro] = useState(() => preference('akamaru-auto-intro', true));
  const options = useRef({ autoNext, autoIntro, intro, outro, onNext });
  options.current = { autoNext, autoIntro, intro, outro, onNext };
  const advanced = useRef(false);
  const introSkipped = useRef(false);
  const lastSeek = useRef(0);
  const origin = new URL(url).origin;
  const supported = ['https://megaplay.buzz', 'https://megaplay.cc'].includes(origin);

  useEffect(() => {
    introSkipped.current = false;
    advanced.current = false;
    manuallyPlaying.current = null;
    setTime(0);
    setPlaying(false);
    setReady(false);
  }, [url]);

  function command(cmd: string, extra: { value?: number } = {}) {
    if (direct) {
      const v = video.current;
      if (!v) return;
      if (cmd === 'SEEK' && extra.value !== undefined) v.currentTime = extra.value;
      if (cmd === 'PLAY_TOGGLE') { if (v.paused) void v.play().catch(() => setNotice('Press Play to start playback.')); else v.pause(); }
      if (cmd === 'MUTE') v.muted = !v.muted;
      return;
    }
    frame.current?.contentWindow?.postMessage({ cmd, ...extra }, origin);
  }

  useEffect(() => {
    if (!direct || !video.current) return;
    const v = video.current;
    let cancelled = false;

    // Restore preferred subtitle track
    const initial = proxiedTracks.findIndex(t => t.default);
    let chosenTrack = initial;
    try {
      const savedLang = localStorage.getItem('akamaru-subtitle-label');
      if (savedLang === 'off') chosenTrack = -1;
      else if (savedLang) {
        const idx = proxiedTracks.findIndex(t => t.label === savedLang);
        if (idx !== -1) chosenTrack = idx;
      }
    } catch {}
    setCaption(chosenTrack);

    const syncTracks = () => {
      if (!v.textTracks) return;
      for (let i = 0; i < v.textTracks.length; i++) {
        v.textTracks[i].mode = i === chosenTrack ? 'showing' : 'disabled';
      }
    };
    v.textTracks.addEventListener('addtrack', syncTracks);
    syncTracks();

    void import('hls.js').then(({ default: Engine }) => {
      if (cancelled) return;
      if (Engine.isSupported()) {
        const engine = new Engine();
        hls.current = engine;
        engine.on(Engine.Events.MANIFEST_PARSED, () => {
          const list = engine.levels.map((l, i) => ({
            id: i,
            height: l.height,
            bitrate: l.bitrate,
            label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps`,
          }));
          setQualities(list);
        });
        engine.on(Engine.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.warn('Playback failed:', data.type, data.details, data.response?.code);
            setSlow(true);
            setNotice('This stream is taking longer than usual. Try reloading or check connection.');
          }
        });
        engine.loadSource(playbackUrl);
        engine.attachMedia(v);
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = playbackUrl;
      } else {
        setNotice('This browser does not support HLS video format.');
      }
    }).catch(() => setNotice('The video engine could not load. Reload the page.'));

    return () => {
      cancelled = true;
      hls.current?.destroy();
      hls.current = null;
      v.textTracks.removeEventListener('addtrack', syncTracks);
      v.removeAttribute('src');
      v.load();
    };
  }, [playbackUrl, direct]);

  function reveal() {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 4000);
  }

  useEffect(() => { if (playing && !menu) reveal(); }, [playing, menu]);

  function saveOption(key: string, value: boolean) {
    try { localStorage.setItem(key, String(value)); } catch { /* Preferences are optional. */ }
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
        setTime(position);
        setDuration(Math.max(0, data.duration));
        if (data.duration > 0) { setReady(true); setSlow(false); }
        if (manuallyPlaying.current === null && position > lastTime && position - lastTime < 3) setPlaying(true);
        if (data.duration > 0 && position >= data.duration - .25) setPlaying(false);
        const settings = options.current;
        if (settings.autoIntro && settings.intro && !introSkipped.current && position >= settings.intro[0] && position < settings.intro[1]) {
          introSkipped.current = true;
          command('SEEK', { value: settings.intro[1] });
        }
        if (settings.intro && position < settings.intro[0]) {
          introSkipped.current = false;
        }
        // Require natural forward progress
        if (settings.autoNext && settings.onNext && !advanced.current && data.duration > 0 && position >= data.duration - .25 &&
          lastTime > 0 && position > lastTime && position - lastTime <= 4 && Date.now() - lastSeek.current > 4000) {
          advanced.current = true;
          settings.onNext();
        }
        lastTime = position;
      }
    }
    function changed() { setFullscreen(document.fullscreenElement === shell.current); reveal(); }
    if (!direct) window.addEventListener('message', message);
    document.addEventListener('fullscreenchange', changed);
    const poll = setInterval(() => command('GET_TIME'), 1000);
    const timeout = setTimeout(() => setSlow(true), 20000);
    return () => {
      window.removeEventListener('message', message);
      document.removeEventListener('fullscreenchange', changed);
      clearInterval(poll);
      clearTimeout(timeout);
      clearTimeout(hideTimer.current);
    };
  }, [url]);

  function toggle() {
    if (!ready) return;
    command('PLAY_TOGGLE');
    if (!direct) {
      manuallyPlaying.current = !playing;
      setPlaying(!playing);
    }
    reveal();
  }

  function seek(value: number) {
    if (!ready || !duration) return;
    const next = Math.min(duration, Math.max(0, value));
    lastSeek.current = Date.now();
    command('SEEK', { value: next });
    setTime(next);
    reveal();
  }

  function mute() {
    if (!ready) return;
    command('MUTE');
    setMuted(value => !value);
    reveal();
  }

  async function expand() {
    try {
      if (document.fullscreenElement === shell.current) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch { setNotice('Fullscreen is not available in this browser.'); }
  }

  if (!direct && !supported) return <div className="cinema-unavailable"><h3>This server needs its own player</h3><p>Choose an HD-1 or Vidstream-2 server to use Akamaru’s controls.</p></div>;

  return <div ref={shell} className={`cinema-player ${visible || !playing || menu ? 'controls-visible' : 'controls-hidden'}`}
    onPointerMove={reveal} onFocus={reveal} onKeyDown={event => {
      if (event.key === 'Escape') { setMenu(null); reveal(); return; }
      if (event.key === 'Tab') reveal();
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return;
      if ([' ', 'k', 'ArrowLeft', 'ArrowRight', 'm', 'f'].includes(event.key)) event.preventDefault();
      if (event.key === ' ' || event.key === 'k') toggle();
      if (event.key === 'ArrowLeft') seek(time - 10);
      if (event.key === 'ArrowRight') seek(time + 10);
      if (event.key === 'm') mute();
      if (event.key === 'f') void expand();
    }} tabIndex={0} role="region" aria-label={`${title} video player`}>
    {direct ? <video ref={video} className="cinema-source" playsInline crossOrigin="anonymous" preload="metadata" autoPlay={autoStart}
      onLoadedMetadata={() => {
        setReady(true);
        setSlow(false);
        const dur = video.current?.duration || 0;
        setDuration(dur);
        if (video.current) video.current.playbackRate = speed;
        if (autoStart) void video.current?.play().catch(() => setNotice('Press Play to continue this episode.'));
      }}
      onPlay={() => {
        setPlaying(true);
        setNotice('');
        if (video.current) video.current.playbackRate = speed;
      }}
      onPause={() => setPlaying(false)}
      onVolumeChange={() => setMuted(video.current?.muted || false)}
      onTimeUpdate={() => {
        const v = video.current;
        if (!v) return;
        setTime(v.currentTime);
        const settings = options.current;
        if (settings.autoIntro && settings.intro && !introSkipped.current && v.currentTime >= settings.intro[0] && v.currentTime < settings.intro[1]) {
          introSkipped.current = true;
          v.currentTime = Math.min(settings.intro[1], v.duration || settings.intro[1]);
        }
        if (settings.intro && v.currentTime < settings.intro[0]) {
          introSkipped.current = false;
        }
      }}
      onEnded={() => {
        setPlaying(false);
        if (options.current.autoNext && !advanced.current && options.current.onNext) {
          advanced.current = true;
          options.current.onNext();
        }
      }}
      onError={() => setNotice('Video playback failed. Try switching servers or reloading.')}>
      {proxiedTracks.map((track, i) => (
        <track key={`${i}-${track.label}`} src={track.url} kind="subtitles" label={track.label} default={track.default} />
      ))}
    </video> : <iframe ref={frame} src={url} title="Video source" tabIndex={-1} aria-hidden="true" className="cinema-source"
      allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />}
    <button className="cinema-click-surface" aria-label={playing ? 'Pause video' : 'Play video'} onClick={toggle} disabled={!ready} tabIndex={-1} />
    <button className="cinema-side cinema-side-left" aria-label="Rewind 10 seconds by clicking left" disabled={!ready || !duration} tabIndex={-1} onClick={() => seek(time - 10)}><span>↶ 10s</span></button>
    <button className="cinema-side cinema-side-right" aria-label="Skip 10 seconds by clicking right" disabled={!ready || !duration} tabIndex={-1} onClick={() => seek(time + 10)}><span>10s ↷</span></button>
    <div className="cinema-heading"><span>AKAMARU</span><strong>{title}</strong></div>
    {!ready && <div className="cinema-loading" role="status"><span className="cinema-spinner" /><p>{slow ? 'The video is taking longer than usual. Try another server below.' : 'Preparing your episode…'}</p></div>}
    {ready && !playing && <button className="cinema-center" onClick={toggle} aria-label="Play"><Play fill="currentColor" size={34} /></button>}
    {ready && intro && time >= intro[0] && time < intro[1] && (
      <button className="cinema-skip-intro" onClick={() => { introSkipped.current = true; seek(intro[1]); }}>
        <SkipForward size={17} /> Skip intro
      </button>
    )}
    {ready && outro && time >= outro[0] && time < (duration || outro[1]) && onNext && (
      <button className="cinema-skip-intro cinema-skip-outro" onClick={() => { advanced.current = true; onNext(); }}>
        <SkipForward size={17} /> Next episode
      </button>
    )}
    {menu && <div className="cinema-menu" role="dialog" aria-label={menu === 'settings' ? 'Playback settings' : menu === 'subtitles' ? 'Subtitles' : 'Video quality'}>
      <div className="cinema-menu-heading"><strong>{menu === 'settings' ? 'Playback settings' : menu === 'subtitles' ? 'Subtitles' : 'Video quality'}</strong><button aria-label="Close player menu" onClick={() => setMenu(null)}><X size={18} /></button></div>
      {menu === 'settings' ? <>
        <label><span>Automatically skip intro</span><input type="checkbox" checked={autoIntro} onChange={e => { setAutoIntro(e.target.checked); saveOption('akamaru-auto-intro', e.target.checked); }} /></label>
        {!intro && <p>Intro timing is unavailable for this episode.</p>}
        <label><span>Autoplay next episode</span><input type="checkbox" checked={autoNext} onChange={e => { setAutoNext(e.target.checked); saveOption('akamaru-auto-next', e.target.checked); }} /></label>
        {!onNext && <p>This is the last available episode.</p>}
        <label><span>Playback speed</span><select aria-label="Playback speed" disabled={!direct} value={speed} onChange={e => {
          const rate = Number(e.target.value);
          setSpeed(rate);
          try { localStorage.setItem('akamaru-playback-speed', String(rate)); } catch {}
          if (video.current) video.current.playbackRate = rate;
        }}>{[.5,.75,1,1.25,1.5,1.75,2,2.5,3].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
        {!direct && <p>This video source does not expose speed control to Akamaru.</p>}
      </> : direct ? menu === 'subtitles' ? <>
        <label>Captions<select aria-label="Subtitle language" value={caption} onChange={e => {
          const selected = Number(e.target.value);
          setCaption(selected);
          const list = video.current?.textTracks;
          if (list) {
            for (let i = 0; i < list.length; i++) list[i].mode = selected === i ? 'showing' : 'disabled';
          }
          try {
            if (selected >= 0 && proxiedTracks[selected]) {
              localStorage.setItem('akamaru-subtitle-label', proxiedTracks[selected].label);
            } else {
              localStorage.setItem('akamaru-subtitle-label', 'off');
            }
          } catch {}
        }}><option value={-1}>Off</option>{proxiedTracks.map((t, i) => <option key={i} value={i}>{t.label}</option>)}</select></label>
        {!proxiedTracks.length && <p>No separate subtitles are available for this source.</p>}
      </> : <>
        <label>Quality<select aria-label="Video quality" value={quality} disabled={!qualities.length} onChange={e => {
          const level = Number(e.target.value);
          setQuality(level);
          if (hls.current) hls.current.currentLevel = level;
        }}><option value={-1}>Auto (Recommended)</option>{qualities.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}</select></label>
        {!qualities.length && <p>Your browser manages quality automatically.</p>}
      </> : <p>{menu === 'subtitles' ? 'Subtitle tracks are managed inside the video source. Its external controls do not support changing or disabling them. Choose a Sub or Dub server below the player.' : 'Quality is managed automatically by the video source. Its external controls do not support manual quality selection.'}</p>}
    </div>}
    <div className="cinema-controls" onPointerDown={reveal}>
      <input className="cinema-progress" aria-label="Seek video" type="range" min="0" max={duration || 1} step="1" value={Math.min(time, duration || 1)} disabled={!ready || !duration} onChange={e => seek(Number(e.target.value))} style={{ background: `linear-gradient(to right, #b30f3c ${duration ? time / duration * 100 : 0}%, #ffffff40 0)` }} />
      <div className="cinema-toolbar">
        <button disabled={!ready} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
        <button disabled={!ready || !duration} onClick={() => seek(time - 10)} aria-label="Back 10 seconds"><RotateCcw /><small>10</small></button>
        <button disabled={!ready || !duration} onClick={() => seek(time + 10)} aria-label="Forward 10 seconds"><RotateCw /><small>10</small></button>
        <button disabled={!ready} onClick={mute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX /> : <Volume2 />}</button>
        <span className="cinema-time">{clock(time)} / {clock(duration)}</span>
        <button aria-label="Subtitles" aria-expanded={menu === 'subtitles'} onClick={() => { setMenu(menu === 'subtitles' ? null : 'subtitles'); reveal(); }}><Captions /></button>
        <button aria-label="Quality" aria-expanded={menu === 'quality'} onClick={() => { setMenu(menu === 'quality' ? null : 'quality'); reveal(); }}><Monitor /></button>
        <button aria-label="Settings" aria-expanded={menu === 'settings'} onClick={() => { setMenu(menu === 'settings' ? null : 'settings'); reveal(); }}><Settings /></button>
        {onNext && <button onClick={onNext} aria-label="Next episode"><SkipForward /></button>}
        <button onClick={() => void expand()} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{fullscreen ? <Minimize /> : <Maximize />}</button>
      </div>
    </div>
    {notice && <p className="cinema-notice" role="status">{notice}</p>}
  </div>;
}
