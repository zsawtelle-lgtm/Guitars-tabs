import { useEffect, useRef, useState } from "react";
import { appleSearchUrl, findExisting, searchCatalogs, type CatalogResult, type CatalogSong } from "../lib/catalog";
import { appleMusicSearchUrl } from "../lib/appleMusic";
import { getSongs, newSongId, saveSong, setSongPrefs, useStoreVersion } from "../lib/storage";
import { formatTime } from "../lib/time";

export function AddFromSearch() {
  useStoreVersion();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CatalogResult | null>(null);
  const results = result?.songs ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const songs = getSongs();

  // Search as you type, after a short pause.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResult(null);
      setError(null);
      return;
    }
    const id = ++latest.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchCatalogs(q)
        .then((r) => {
          if (id !== latest.current) return;
          setResult(r);
          setError(null);
        })
        .catch((e: Error) => id === latest.current && setError(e.message))
        .finally(() => id === latest.current && setLoading(false));
    }, 700);
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
      mbid: c.mbid,
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
        Search Apple Music's catalog. The title, artist, album and length come straight from the catalog, never typed in
        by guesswork. Next you'll add chords from a published chord sheet.
      </p>
      <input className="search" type="search" autoFocus placeholder="Song or artist…" value={query}
        onChange={(e) => setQuery(e.target.value)} aria-label="Search Apple Music" />

      {loading && <p className="muted">Searching…</p>}
      {error && (
        <div className="video-error">
          <p>{error}. Check your connection, or turn off any content blocker for this site, and try again.</p>
          <p className="muted">
            To check Apple's search on this device,{" "}
            <a href={appleSearchUrl(query)} target="_blank" rel="noreferrer">open it directly ↗</a>. If that shows text
            starting with <code>{"{"}"resultCount"</code>, Apple is reachable.
          </p>
        </div>
      )}
      {result?.appleFailed && (
        <p className="catalog-note">
          Apple Music's search couldn't be reached from this browser, so these results are from <b>MusicBrainz</b>, an
          open music database. After adding, use{" "}
          <a href={appleMusicSearchUrl(query, "")} target="_blank" rel="noreferrer">Search Apple Music ↗</a> to grab
          the Apple Music link.
        </p>
      )}
      {results && !results.length && !loading && <p className="empty">No songs found.</p>}

      {results && results.length > 0 && (
        <ul className="catalog-list">
          {results.map((c) => {
            const existing = findExisting(songs, c);
            return (
              <li key={c.appleId ?? c.mbid} className="catalog-row">
                {c.artwork ? (
                  <img src={c.artwork} alt="" className="catalog-art" loading="lazy"
                    onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                ) : <div className="catalog-art" />}
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
      {result && (
        <p className="muted catalog-credit">
          Song details from {result.source === "apple" ? "Apple Music" : "MusicBrainz (musicbrainz.org)"}.
        </p>
      )}
    </div>
  );
}
