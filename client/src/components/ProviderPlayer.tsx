import './CinemaPlayer.css';
import { Minimize } from 'lucide-react';
import useLandscapePlayer from '../lib/useLandscapePlayer';
import type { IframeHTMLAttributes } from 'react';

export default function ProviderPlayer({ url, title, sandbox, referrerPolicy = 'strict-origin-when-cross-origin' }: { url: string; title: string; sandbox?: string; referrerPolicy?: IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy'] }) {
  const { container, viewport, toggle } = useLandscapePlayer();
  return <div ref={container} className={`provider-original-player ${viewport ? 'player-viewport' : ''}`}><iframe src={url} title={`${title} · Video player`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen sandbox={sandbox} referrerPolicy={referrerPolicy} />{viewport && <button className="player-exit" onClick={() => void toggle()} aria-label="Exit fullscreen"><Minimize size={20}/></button>}</div>;
}
