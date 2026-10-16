import { Link } from "react-router-dom";
export default function Footer() {
  return (
    <footer>
      <Link className="brand" to="/">
        akamaru<span className="brand-dot">.</span>
      </Link>
      <p>A new world. One story away.</p>
      <span>Demo catalog · Video previews from YouTube</span>
    </footer>
  );
}
