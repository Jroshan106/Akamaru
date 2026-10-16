import { Link } from "react-router-dom";
export default function Footer() {
  return (
    <footer>
      <Link className="brand" to="/">
        akamaru<span className="brand-dot">.</span>
      </Link>
      <p>A new world. One story away.</p>
      <span>
        Anime data via{" "}
        <a href="https://tenrai.org/" target="_blank" rel="noreferrer">
          Tenrai
        </a>{" "}
        / MyAnimeList · YouTube trailers
      </span>
    </footer>
  );
}
