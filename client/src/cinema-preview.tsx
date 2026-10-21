import { createRoot } from 'react-dom/client';
import ProviderPlayer from './components/ProviderPlayer';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1000,margin:'40px auto'}}><h1>Akamaru</h1><ProviderPlayer url="https://player.abyssplayer.com/OVbVA_iz5" title="Frieren · Abyss preview" referrerPolicy="origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" /></main>);
