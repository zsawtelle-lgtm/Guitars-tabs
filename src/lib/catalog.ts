// Song lookup in Apple's public catalog (the iTunes Search API: no account or key).
// It's read via JSONP so it works from any static site regardless of CORS.

export interface CatalogSong {
  appleId: number;
  title: string;
  artist: string;
  album?: string;
  /** Seconds. */
  duration?: number;
  year?: number;
  genre?: string;
  artwork?: string;
  /** music.apple.com link to the track. */
  url?: string;
}

interface ITunesTrack {
  wrapperType?: string;
  kind?: string;
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
}

export function toCatalogSong(t: ITunesTrack): CatalogSong {
  let url: string | undefined;
  if (t.trackViewUrl) {
    const u = new URL(t.trackViewUrl);
    u.searchParams.delete("uo"); // affiliate/tracking noise
    url = u.toString();
  }
  const year = t.releaseDate ? new Date(t.releaseDate).getUTCFullYear() : undefined;
  return {
    appleId: t.trackId,
    title: t.trackName,
    artist: t.artistName,
    album: t.collectionName,
    duration: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : undefined,
    year: Number.isFinite(year) ? year : undefined,
    genre: t.primaryGenreName,
    artwork: t.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/300x300bb."),
    url,
  };
}

let callbackCount = 0;

/** Searches Apple's catalog for songs. Rejects if the service can't be reached. */
export function searchAppleCatalog(term: string, limit = 15): Promise<CatalogSong[]> {
  const q = term.trim();
  if (!q) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const name = `__fretboardCatalog${++callbackCount}`;
    const script = document.createElement("script");
    const cleanup = () => {
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[name];
      script.remove();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apple Music search timed out"));
    }, 10000);
    (window as unknown as Record<string, unknown>)[name] = (data: { results?: ITunesTrack[] }) => {
      cleanup();
      const songs = (data.results ?? [])
        .filter((t) => (t.wrapperType ?? "track") === "track" && (t.kind ?? "song") === "song")
        .map(toCatalogSong);
      resolve(songs);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Couldn't reach Apple Music search"));
    };
    const params = new URLSearchParams({ term: q, media: "music", entity: "song", limit: String(limit), callback: name });
    script.src = `https://itunes.apple.com/search?${params}`;
    document.head.appendChild(script);
  });
}

/** Loose form of a title/artist for spotting the same song: case, punctuation and "(Remastered…)" ignored. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*[([].*?(remaster|live|version|mono|stereo|edit|mix|feat).*?[)\]]/g, "")
    .replace(/\s+-\s+.*(remaster|live|version|edit|mix).*$/, "")
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The song in `songs` that this catalog entry refers to, if any. */
export function findExisting<T extends { appleId?: number; title: string; artist: string }>(
  songs: T[],
  c: CatalogSong,
): T | undefined {
  const title = normalizeName(c.title);
  const artist = normalizeName(c.artist);
  return (
    songs.find((s) => s.appleId === c.appleId) ??
    songs.find((s) => normalizeName(s.title) === title && normalizeName(s.artist) === artist)
  );
}

/** Searches on established chord/tab sites, for finding a real chord sheet to paste. */
export function chordSearchLinks(title: string, artist: string): { label: string; url: string }[] {
  const q = `${title} ${artist}`.trim();
  return [
    { label: "Ultimate Guitar", url: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}` },
    { label: "Songsterr (tabs)", url: `https://www.songsterr.com/?pattern=${encodeURIComponent(q)}` },
    { label: "Web search", url: `https://www.google.com/search?q=${encodeURIComponent(`${q} chords`)}` },
  ];
}
