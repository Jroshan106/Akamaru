import React from 'react';
import { createRoot } from 'react-dom/client';
import CinemaPlayer from './components/CinemaPlayer';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:1000,margin:'40px auto'}}><h1>Akamaru</h1><CinemaPlayer url="https://megaplay.buzz/stream/s-2/107257/sub?s=tcdn" title="Frieren: Beyond Journey’s End · Episode 1" /></main>);
