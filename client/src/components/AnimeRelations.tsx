import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { jikanRequest } from '../lib/jikan';
import ThemedSelect from './ThemedSelect';
type Relation = { relation: string; entry: { mal_id: number; type: string; name: string }[] };
function useRelations(id: string) {
  const [items, setItems] = useState<Relation[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setItems([]); setError(false);
    jikanRequest<{data: Relation[]}>(`/anime/${id}/relations`).then(r => { if (!cancelled) setItems(r.data); }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, attempt]);
  return { items, loading, error, retry: () => setAttempt(n=>n+1) };
}
export function SeasonSelect({ id, title }: { id: string; title: string }) {
  const { items, loading, error, retry } = useRelations(id);
  const navigate = useNavigate();
  const entries = [...new Map(items.filter(r => ['prequel','sequel','parent story','side story','spin-off','alternative version','alternative setting'].includes(r.relation.toLowerCase())).flatMap(r => r.entry.filter(e => e.type === 'anime' && String(e.mal_id) !== id).map(e => [e.mal_id, { ...e, relation:r.relation }] as const))).values()];
  return <div className="season-selector"><label>Change seasons<ThemedSelect aria-label="Change seasons" value={id} disabled={loading || !entries.length} onChange={e => navigate(`/anime/${e.target.value}/episodes/1`)}><option value={id}>{title} (current)</option>{entries.map(e => <option key={e.mal_id} value={String(e.mal_id)}>{e.relation}: {e.name}</option>)}</ThemedSelect></label>{loading ? <small>Loading related seasons...</small> : error ? <button className="text-link" onClick={retry}>Retry seasons</button> : !entries.length ? <small>No related seasons listed.</small> : null}</div>;
}
export default function AnimeRelations({id}: {id:string}) {
  const {items, loading, error, retry} = useRelations(id);
  return <section className="catalog-section"><h2>Related anime</h2>{loading ? <p role="status">Loading relations...</p> : error ? <button className="button secondary" onClick={retry}>Retry relations</button> : <div className="relations-grid">{items.flatMap(r => r.entry.filter(e=> e.type==='anime').map(e=><Link className="relation-link" key={`${r.relation}-${e.mal_id}`} to={`/anime/${e.mal_id}`}><span className="eyebrow">{r.relation}</span><strong>{e.name}</strong><ArrowRight size={18}/></Link>))}{!items.some(r=>r.entry.some(e=>e.type==='anime')) && <p className="muted">No anime relations are listed yet.</p>}</div>}</section>;
}
