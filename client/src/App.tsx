import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage';
import WatchPage from './pages/WatchPage';
import AnimeDetailPage from './pages/AnimeDetailPage';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-300">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/anime/:id" element={<AnimeDetailPage />} />
          <Route path="/watch/:animeId/:episodeId" element={<WatchPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
