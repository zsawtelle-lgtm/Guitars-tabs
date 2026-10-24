import { useEffect, useState } from "react";
import { getSong, getTheme, setTheme, useStoreVersion } from "./lib/storage";
import { useMetronome } from "./lib/hooks";
import { Library } from "./components/Library";
import { SongPage } from "./components/SongPage";
import { Editor } from "./components/Editor";
import { ChordLibrary } from "./components/ChordLibrary";
import { MetronomePanel, toggleMetronome } from "./components/MetronomePanel";

type Route =
  | { name: "library" }
  | { name: "song"; id: string }
  | { name: "edit"; id: string }
  | { name: "new" }
  | { name: "chords" }
  | { name: "metronome" };

function parseHash(hash: string): Route {
  const [, page, id] = hash.replace(/^#/, "").split("/");
  const decoded = id ? decodeURIComponent(id) : "";
  switch (page) {
    case "song":
      return { name: "song", id: decoded };
    case "edit":
      return { name: "edit", id: decoded };
    case "new":
      return { name: "new" };
    case "chords":
      return { name: "chords" };
    case "metronome":
      return { name: "metronome" };
    default:
      return { name: "library" };
  }
}

export function App() {
  useStoreVersion();
  const [route, setRoute] = useState(() => parseHash(location.hash));
  const metro = useMetronome();
  const theme = getTheme();

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  let content;
  switch (route.name) {
    case "song": {
      const song = getSong(route.id);
      content = song ? <SongPage key={song.id} song={song} /> : <NotFound />;
      break;
    }
    case "edit": {
      const song = getSong(route.id);
      content = song ? <Editor key={song.id + song.updatedAt} song={song} /> : <NotFound />;
      break;
    }
    case "new":
      content = <Editor key="new" />;
      break;
    case "chords":
      content = <ChordLibrary />;
      break;
    case "metronome":
      content = (
        <div className="page">
          <h1>Metronome</h1>
          <MetronomePanel />
        </div>
      );
      break;
    default:
      content = <Library />;
  }

  const nav = (href: string, label: string, active: boolean) => (
    <a href={href} className={"nav-link" + (active ? " active" : "")}>{label}</a>
  );

  return (
    <>
      <header className="app-header">
        <a href="#/" className="logo">
          <span className="logo-mark">♪</span> Fretboard
        </a>
        <nav className="app-nav">
          {nav("#/", "Songs", route.name === "library" || route.name === "song")}
          {nav("#/chords", "Chords", route.name === "chords")}
          {nav("#/metronome", "Metronome", route.name === "metronome")}
        </nav>
        <div className="header-actions">
          {metro.running && route.name !== "song" && (
            <button className="metro-badge" onClick={toggleMetronome} title="Stop metronome">
              ♩ {metro.bpm} ■
            </button>
          )}
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle light/dark theme" title="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>
      <main>{content}</main>
    </>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Song not found</h1>
      <p><a href="#/">Back to songs</a></p>
    </div>
  );
}
