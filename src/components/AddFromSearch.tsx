import { useEffect, useRef, useState } from "react";
import { findExisting, searchAppleCatalog, type CatalogSong } from "../lib/catalog";
import { getSongs, newSongId, saveSong, setSongPrefs, useStoreVersion } from "../lib/storage";
import { formatTime } from "../lib/time";

export function AddFromSearch() {
  useStoreVersion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSong[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const songs = getSongs();

  // Search as you type, after a short pause.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      return;
    }
    const id = ++latest.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchAppleCatalog(q)
        .then((r) => {
          if (id !== latest.current) return;
          setResults(r);
          setError(null);
        })
        .catch((e: Error) => id === latest.current && setError(e.message))
        .finally(() => id === latest.current && setLoading(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const add = (c: CatalogSong) => {
    const song = saveSong({
      id: newSongId(),
      title: c.title,
      artist: c.artist,
      album: c.album,
      artwork: c.artwork,
      appleId: c.appleId,
      duration: c.duration,
      body: "",
    });
    if (c.url) setSongPrefs(song.id, { appleMusicUrl: c.url });
    location.hash = `#/edit/${encodeURIComponent(song.id)}`;
  };

  return (
    <div className="page add-search">
      <h1>Add a song</h1>
      <p className="muted">
        Search Apple Music's catalog. The title, artist, album, length and Apple Music link come straight from Apple.
        Next you'll add chords from a published chord sheet.
      </p>
      <input className="search" type="search" autoFocus placeholder="Song or artist…" value={query}
        onChange={(e) => setQuery(e.target.value)} aria-label="Search Apple Music" />

      {loading && <p className="muted">Searching Apple Music…</p>}
      {error && <p className="video-error">{error}. Check your connection and try again.</p>}
      {results && !results.length && !loading && <p className="empty">No songs found on Apple Music.</p>}

      {results && results.length > 0 && (
        <ul className="catalog-list">
          {results.map((c) => {
            const existing = findExisting(songs, c);
            return (
              <li key={c.appleId} className="catalog-row">
                {c.artwork ? <img src={c.artwork} alt="" className="catalog-art" loading="lazy" /> : <div className="catalog-art" />}
                <div className="catalog-main">
                  <span className="song-row-title">{c.title}</span>
                  <span className="song-row-artist">
                    {[c.artist, c.album, c.year].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <span className="muted catalog-time">{c.duration ? formatTime(c.duration) : ""}</span>
                {existing ? (
                  <a className="btn" href={`#/song/${encodeURIComponent(existing.id)}`}>In your songs →</a>
                ) : (
                  <button type="button" className="btn primary" onClick={() => add(c)}>Add</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted catalog-credit">Song details from Apple Music.</p>
    </div>
  );
}
