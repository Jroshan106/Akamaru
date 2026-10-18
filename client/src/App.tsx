import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import WatchPage from "./pages/WatchPage";
import AnimeDetailPage from "./pages/AnimeDetailPage";
import EpisodesPage from "./pages/EpisodesPage";
import LibraryPage from "./pages/LibraryPage";
import LocalPage from "./pages/LocalPage";
import { CatalogProvider } from "./lib/catalog";
import { NotFound } from "./components/CatalogUI";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <CatalogProvider>
      <div className="app-shell">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/watchlist" element={<LibraryPage />} />
            <Route path="/local" element={<LocalPage />} />
            <Route path="/anime/:id" element={<AnimeDetailPage />} />
            <Route path="/anime/:id/episodes" element={<EpisodesPage />} />
            <Route path="/anime/:id/episodes/:episodeNumber" element={<EpisodesPage />} />
            <Route path="/watch/:animeId/:episodeId" element={<WatchPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </CatalogProvider>
  );
}

export default App;
