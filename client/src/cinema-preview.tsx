import { createRoot } from 'react-dom/client';
import ProviderPlayer from './components/ProviderPlayer';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1000,margin:'40px auto'}}><h1>Akamaru</h1><ProviderPlayer url="https://ravok.buzz/video/4c12343400ce0c1454ad4bc3860602b9" title="Frieren · Ravok preview" referrerPolicy="origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" /></main>);
