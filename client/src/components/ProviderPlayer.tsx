import './CinemaPlayer.css';

export default function ProviderPlayer({ url, title }: { url: string; title: string }) {
  return <div className="provider-original-player"><iframe src={url} title={`${title} · Original provider player`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>;
}
