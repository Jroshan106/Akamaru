import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Search, Bookmark, House, Compass, History } from "lucide-react";
import { FormEvent, useState } from "react";
export default function Navbar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const isBrowse = useLocation().pathname.replace(/\/$/, "") === "/browse";
  function search(event: FormEvent) {
    event.preventDefault();
    navigate(`/browse?search=${encodeURIComponent(query.trim())}`);
  }
  return (
    <><header className="navbar">
      <Link to="/" className="brand">
        <img className="brand-logo" src="/akamaru-logo.png" alt="Akamaru" width="648" height="216" />
      </Link>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>
          Discover
        </NavLink>
        <NavLink to="/browse">Browse anime</NavLink>
        <NavLink to="/watchlist">
          <Bookmark size={16} /> Library
        </NavLink>
        <NavLink to="/history">History</NavLink>
      </nav>
      {!isBrowse && <form onSubmit={search} className="nav-search">
        <Search size={17} />
        <input
          aria-label="Search anime"
          placeholder="Find your next anime"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" aria-label="Search">
          ↵
        </button>
      </form>}
      {!isBrowse && <Link className="mobile-search" to="/browse" aria-label="Search anime"><Search size={21} /></Link>}
    </header>
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      <NavLink to="/" end><House size={21} /><span>Discover</span></NavLink>
      <NavLink to="/browse"><Compass size={21} /><span>Explore</span></NavLink>
      <NavLink to="/watchlist"><Bookmark size={21} /><span>Library</span></NavLink>
      <NavLink to="/history"><History size={21} /><span>History</span></NavLink>
    </nav></>
  );
}
