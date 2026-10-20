import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import ThemedSelect from './ThemedSelect';
import { useSearchParams } from 'react-router-dom';

async function request(path:string, init?:RequestInit) {
  const response=await fetch(`/api/mal${path}`,init);
  const data=await response.json();
  if (!response.ok) throw new Error(data.error || 'MyAnimeList is unavailable.');
  return data;
}
export default function MalTracker({id,title}: {id:string;title:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [open,setOpen]=useState(() => searchParams.get('mal') === 'connected');
  const [attempt,setAttempt]=useState(0);
  const [connection,setConnection]=useState<{configured:boolean;connected:boolean} | null>(null);
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [message,setMessage]=useState('');
  const [status,setStatus]=useState('plan_to_watch');
  const [episodes,setEpisodes]=useState(0);
  const [score,setScore]=useState(0);
  useEffect(()=>{
    if (!open) return;
    dialog.current?.showModal();
    let cancelled=false;
    setBusy(true);setLoaded(false);setMessage('');setConnection(null);
    void request('/status').then(async c=>{
      if(cancelled)return;
      setConnection(c);
      if(c.connected){
        const data=await request(`/anime/${id}`);
        if(cancelled)return;
        setStatus(data.entry?.status || 'plan_to_watch');setEpisodes(data.entry?.num_episodes_watched || 0);setScore(data.entry?.score || 0);setLoaded(true);
      }
    }).catch(e=>{if(!cancelled)setMessage(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});
    return()=>{cancelled=true;};
  },[open,id,attempt]);
  function close(){dialog.current?.close();setOpen(false);if(searchParams.has('mal')){const next=new URLSearchParams(searchParams);next.delete('mal');setSearchParams(next,{replace:true});}}
  async function save(){
    setBusy(true);setMessage('');
    try{await request(`/anime/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json','X-Akamaru-Request':'tracking'},body:JSON.stringify({status,episodes,score})});setMessage('Saved to MyAnimeList.');}
    catch(e){setMessage(e instanceof Error ? e.message : 'Unable to save.');}
    finally{setBusy(false);}
  }
  return <><button className="save-button mal-track-button" aria-label="Track on MyAnimeList" title="Track on MyAnimeList" onClick={()=>setOpen(true)}><span aria-hidden="true">MAL</span></button><dialog className="mal-dialog" ref={dialog} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} aria-labelledby={`mal-heading-${id}`}><div className="mal-dialog-heading"><h2 id={`mal-heading-${id}`}>MyAnimeList tracking</h2><button className="save-button" onClick={close} aria-label="Close MyAnimeList tracking"><X size={18}/></button></div><p>{title}</p>{busy && <p role="status">Connecting to MyAnimeList...</p>}{!busy && connection && !connection.configured ? <div className="source-note"><p>Account syncing is not available yet. You can still update this title directly on MyAnimeList.</p><a className="button primary" href={`https://myanimelist.net/ownlist/anime/${id}/edit`} target="_blank" rel="noreferrer">Update on MyAnimeList</a></div> : !busy && connection?.configured && !connection.connected ? <><p>Connect your account to update your watch status, episode count, and score.</p><a className="button primary" href={`/api/mal/connect?anime=${id}`}>Connect MyAnimeList</a></> : connection?.connected ? <form onSubmit={e=>{e.preventDefault();void save();}}><label>Watch status<ThemedSelect aria-label="MyAnimeList watch status" value={status} disabled={busy || !loaded} onChange={e=>setStatus(e.target.value)}>{[['plan_to_watch','Plan to watch'],['watching','Watching'],['completed','Completed'],['on_hold','On hold'],['dropped','Dropped']].map(([value,name])=><option key={value} value={value}>{name}</option>)}</ThemedSelect></label><label>Episodes watched<input type="number" min={0} max={100000} required value={episodes} disabled={busy || !loaded} onChange={e=>setEpisodes(Number(e.target.value))}/></label><label>Score<ThemedSelect aria-label="MyAnimeList score" value={String(score)} disabled={busy || !loaded} onChange={e=>setScore(Number(e.target.value))}>{Array.from({length:11},(_,i)=><option key={i} value={String(i)}>{i || 'Not rated'}</option>)}</ThemedSelect></label><button className="button primary" type="submit" disabled={busy || !loaded}><RefreshCw size={16}/> Save to MyAnimeList</button><a className="text-link" href={`/api/mal/connect?anime=${id}`}>Reconnect account</a><button type="button" className="text-link" disabled={busy} onClick={async()=>{setBusy(true);try{await request('/disconnect',{method:'POST',headers:{'X-Akamaru-Request':'tracking'}});setConnection(c=>(c ? {...c,connected:false} : null));setMessage('Disconnected from this browser.');}catch(e){setMessage(e instanceof Error ? e.message : 'Unable to disconnect.');}finally{setBusy(false);}}}>Disconnect</button></form> : null}{message && <p role="status">{message}</p>}{!busy && (!connection || (connection.connected && !loaded)) && <button className="button secondary" onClick={()=>setAttempt(n=>n+1)}>Retry connection</button>}<a className="text-link" href={`https://myanimelist.net/anime/${id}`} target="_blank" rel="noreferrer">View on MyAnimeList</a></dialog></>;
}
