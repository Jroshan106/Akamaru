import ThemedSelect from '../components/ThemedSelect';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Library } from 'lucide-react';
import { useCatalog } from '../lib/catalog';
import { AnimeCard, CatalogState } from '../components/CatalogUI';

const categories = ['Plan to watch', 'Watching', 'Completed', 'On hold'] as const;
export default function LibraryPage() {
  const { anime, loading, error, saved } = useCatalog();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [statuses, setStatuses] = useState<Record<string, string>>(() => {
    try { const data = JSON.parse(localStorage.getItem('akamaru-library-status') || '{}'); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; } catch { return {}; }
  });
  const [notice, setNotice] = useState('');
  const status = (id: string) => categories.includes(statuses[id] as typeof categories[number]) ? statuses[id] : categories[0];
  const items = anime.filter(a => saved.includes(a.id));
  const results = items.filter(a => (filter === 'All' || status(a.id) === filter) && `${a.title} ${a.japaneseTitle}`.toLowerCase().includes(query.toLowerCase()));
  function update(id: string, value: string) {
    const next = { ...statuses, [id]: value }; setStatuses(next);
    try { localStorage.setItem('akamaru-library-status', JSON.stringify(next)); } catch { setNotice('Browser storage is unavailable. Changes will last for this session.'); }
  }
  return <div className="page hub-page">
    <div className="hub-heading"><div><span className="eyebrow">YOUR ANIME, YOUR PACE</span><h1>Library<span className="accent">.</span></h1><p className="muted">Organize your next watch. Your library stays on this browser.</p></div><Link to="/browse" className="button primary">Find anime</Link></div>
    <div className="library-tabs" aria-label="Library categories">{['All', ...categories].map(category => <button key={category} aria-pressed={filter === category} className={filter === category ? 'selected' : ''} onClick={() => setFilter(category)}>{category} <span>{category === 'All' ? items.length : items.filter(a => status(a.id) === category).length}</span></button>)}</div>
    <label className="library-search"><Search size={18}/><input aria-label="Search your library" placeholder="Search your library…" value={query} onChange={e => setQuery(e.target.value)}/></label>
    {notice && <p role="status">{notice}</p>}
    {loading || error ? <CatalogState/> : results.length ? <div className="anime-grid library-grid">{results.map(a => <div className="library-card" key={a.id}><AnimeCard anime={a}/><label className="library-status">Watch status<ThemedSelect aria-label={`Watch status for ${a.title}`} value={status(a.id)} onChange={e => update(a.id, e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</ThemedSelect></label></div>)}</div> : <div className="empty"><Library size={40}/><h2>{saved.length ? 'No titles in this view' : 'Make room for your next favorite'}</h2><p>{saved.length ? 'Try another category or search.' : 'Bookmark an anime while browsing, then organize it here.'}</p><Link className="button secondary" to="/browse">Explore anime</Link></div>}
  </div>;
}


