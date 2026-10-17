import { createRoot } from 'react-dom/client';
import CinemaPlayer from './components/CinemaPlayer';
import DirectSourcePlayer from './components/DirectSourcePlayer';
import ProviderPlayer from './components/ProviderPlayer';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1000,margin:'40px auto'}}><h1>Akamaru</h1>{new URLSearchParams(location.search).has('original') ? <ProviderPlayer url="https://megaplay.buzz/stream/s-2/863797/sub?s=tcdn" title="Original provider preview" /> : new URLSearchParams(location.search).has('direct') ? <DirectSourcePlayer animeId="preview" episode="1" title="Direct player preview · Episode 1" /> : <CinemaPlayer url="https://megaplay.buzz/stream/s-2/107257/sub?s=tcdn" intro={[0, 89]} title="Frieren: Beyond Journey’s End · Episode 1" />}</main>);

