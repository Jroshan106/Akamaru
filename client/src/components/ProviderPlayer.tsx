import './CinemaPlayer.css';
import { Minimize } from 'lucide-react';
import useLandscapePlayer from '../lib/useLandscapePlayer';

export default function ProviderPlayer({ url, title }: { url: string; title: string }) {
  const { container, viewport, toggle } = useLandscapePlayer();
  return <div ref={container} className={`provider-original-player ${viewport ? 'player-viewport' : ''}`}><iframe src={url} title={`${title} · Original provider player`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />{viewport && <button className="player-exit" onClick={() => void toggle()} aria-label="Exit fullscreen"><Minimize size={20}/></button>}</div>;
}
