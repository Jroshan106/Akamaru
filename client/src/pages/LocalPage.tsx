import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import CinemaPlayer from '../components/CinemaPlayer';

export default function LocalPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <div className="page hub-page"><span className="eyebrow">FROM YOUR DEVICE</span><h1>Local player<span className="accent">.</span></h1><p className="muted">Open a video you already have. Files play on your device and are never uploaded.</p>
    <section className="local-picker"><FolderOpen size={36}/><div><h2>{file ? file.name : 'Your files. Your player.'}</h2><p>Choose an MP4 or WebM video. Other formats depend on your browser’s codec support.</p></div><label className="button primary file-button">{file ? 'Choose another video' : 'Open video'}<input type="file" accept="video/*,.mkv" aria-label="Open a local video" onChange={e => { const next = e.target.files?.[0]; if(next) { setUrl(''); setFile(next); } e.target.value = ''; }}/></label></section>
    {url && file && <CinemaPlayer key={url} url={url} title={file.name} direct/>}
    <div className="source-note"><h3>Ready when you are</h3><p>Use the player’s speed, fullscreen and 10-second controls. Reopen your file after refreshing or leaving this page. Subtitle and quality choices depend on the video source.</p></div>
  </div>;
}
