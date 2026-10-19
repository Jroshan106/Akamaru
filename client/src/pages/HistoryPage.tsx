import { Link } from 'react-router-dom';
import { History, Play } from 'lucide-react';
import { useHistory, WatchEntry } from '../lib/history';

function WatchCard({ item, latest = false }: { item: WatchEntry; latest?: boolean }) {
  const percent = item.duration > 0 ? Math.min(100, item.time / item.duration * 100) : 0;
  return <Link className={`history-card ${latest ? 'history-latest' : ''}`} to={`/anime/${encodeURIComponent(item.animeId)}/episodes/${encodeURIComponent(item.episode)}`} onClick={() => { try { localStorage.setItem('akamaru-source', item.source); } catch {} }}>
    <img src={item.cover} alt="" loading="lazy" onError={e => { if (!e.currentTarget.src.endsWith('/placeholder.svg')) e.currentTarget.src='/placeholder.svg'; }}/>
    <div>{latest && <span className="eyebrow">LAST WATCHED</span>}<h2>{item.title}</h2><strong>Episode {item.episode}</strong><p>{Math.floor(item.time / 60)} min watched{item.duration > 0 ? ` of ${Math.ceil(item.duration / 60)} min` : ''} · {new Date(item.watchedAt).toLocaleDateString()}</p><div className="history-progress" role="progressbar" aria-label="Episode progress" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }}/></div><span className="history-open"><Play size={16} fill="currentColor"/> Open episode</span></div>
  </Link>;
}
export function RecentWatch() {
  const [latest] = useHistory();
  return latest ? <section className="recent-watch"><div className="section-heading"><h2>Recently watched<span className="accent">.</span></h2><Link className="button primary view-history-button" to="/history"><History size={18} aria-hidden="true"/> View history</Link></div><WatchCard item={latest} latest/></section> : null;
}
export default function HistoryPage() {
  const items = useHistory();
  return <div className="page hub-page"><div className="hub-heading"><div><span className="eyebrow">YOUR WATCHING JOURNEY</span><h1>History<span className="accent">.</span></h1><p className="muted">Episodes you played on this browser. Progress updates while watching.</p></div></div>{items.length ? <div className="history-list">{items.map((item, i) => <WatchCard key={`${item.animeId}-${item.episode}`} item={item} latest={i === 0}/>)}</div> : <div className="empty"><History size={40}/><h2>Your story starts here</h2><p>Play an episode and it will appear here automatically.</p><Link className="button primary" to="/browse">Find anime</Link></div>}</div>;
}
