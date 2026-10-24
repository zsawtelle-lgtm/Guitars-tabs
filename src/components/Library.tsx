import { useMemo, useState } from "react";
import { getFavorites, getSongs, useStoreVersion } from "../lib/storage";
import { chordsInSong, parseSong } from "../lib/parser";

type Filter = "all" | "favorites" | "mine";

export function Library() {
  useStoreVersion();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const songs = getSongs();
  const favorites = getFavorites();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs
      .filter((s) => (filter === "favorites" ? favorites.includes(s.id) : filter === "mine" ? !s.builtIn : true))
      .filter((s) => !q || `${s.title} ${s.artist}`.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, favorites, query, filter]);

  return (
    <div className="page library">
      <div className="library-head">
        <h1>Songs</h1>
        <a className="btn primary" href="#/new">+ New song</a>
      </div>
      <input
        className="search" type="search" placeholder="Search songs or artists…" value={query}
        onChange={(e) => setQuery(e.target.value)} aria-label="Search songs"
      />
      <div className="tabs" role="tablist">
        {(["all", "favorites", "mine"] as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={"tab" + (filter === f ? " selected" : "")}
            onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "favorites" ? "★ Favorites" : "My songs"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="empty">
          {filter === "favorites" ? "No favorites yet. Tap ☆ on a song to save it here."
            : filter === "mine" ? "You haven't added any songs yet."
              : "No songs match your search."}
        </p>
      ) : (
        <ul className="song-list">
          {shown.map((s) => {
            const chords = chordsInSong(parseSong(s.body)).slice(0, 6);
            return (
              <li key={s.id}>
                <a className="song-row" href={`#/song/${encodeURIComponent(s.id)}`}>
                  <div className="song-row-main">
                    <span className="song-row-title">
                      {favorites.includes(s.id) && <span className="star on">★ </span>}
                      {s.title}
                    </span>
                    <span className="song-row-artist">{s.artist}</span>
                  </div>
                  <div className="song-row-chords">
                    {chords.map((c) => <span key={c} className="chord-pill">{c}</span>)}
                  </div>
                  <div className="song-row-meta">
                    {s.key && <span>Key {s.key}</span>}
                    {s.tempo && <span>{s.tempo} BPM</span>}
                    {!s.builtIn && <span className="badge">Mine</span>}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
