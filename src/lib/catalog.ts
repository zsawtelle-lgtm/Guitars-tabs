// Song lookup in established catalogs, so a song's details are never typed in by guesswork.
// Apple's catalog (the iTunes Search API) comes first. It doesn't allow direct browser
// requests everywhere, so it's tried directly and then via JSONP. If Apple can't be
// reached, MusicBrainz (an open music database that does allow browser requests) is used.

export type CatalogName = "apple" | "musicbrainz";

export interface CatalogSong {
  source: CatalogName;
  appleId?: number;
  /** MusicBrainz recording ID. */
  mbid?: string;
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
    source: "apple",
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

const TIMEOUT_MS = 8000;

/** Curly quotes and the like confuse some search services. */
function plainQuery(term: string): string {
  return term.replace(/[‘’ʼ`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

export function appleSearchUrl(term: string, limit = 15, callback?: string): string {
  const params = new URLSearchParams({ term: plainQuery(term), media: "music", entity: "song", limit: String(limit) });
  if (callback) params.set("callback", callback);
  return `https://itunes.apple.com/search?${params}`;
}

function appleResults(data: { results?: ITunesTrack[] }): CatalogSong[] {
  return (data.results ?? [])
    .filter((t) => (t.wrapperType ?? "track") === "track" && (t.kind ?? "song") === "song")
    .map(toCatalogSong);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

let callbackCount = 0;

function appleJsonp(term: string, limit: number): Promise<CatalogSong[]> {
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
      reject(new Error("timed out"));
    }, TIMEOUT_MS);
    (window as unknown as Record<string, unknown>)[name] = (data: { results?: ITunesTrack[] }) => {
      cleanup();
      resolve(appleResults(data));
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("blocked"));
    };
    script.src = appleSearchUrl(term, limit, name);
    document.head.appendChild(script);
  });
}

/** Searches Apple's catalog for songs, directly and then via JSONP. */
export async function searchAppleCatalog(term: string, limit = 15): Promise<CatalogSong[]> {
  if (!term.trim()) return [];
  try {
    return appleResults(await fetchJson(appleSearchUrl(term, limit)));
  } catch {
    return appleJsonp(term, limit);
  }
}

// ---------- MusicBrainz ----------

interface MBRecording {
  id: string;
  title: string;
  length?: number;
  score?: number;
  video?: boolean;
  "artist-credit"?: { name: string; joinphrase?: string }[];
  releases?: { id: string; title: string; date?: string; status?: string }[];
}

export function fromMusicBrainz(recordings: MBRecording[]): CatalogSong[] {
  const seen = new Set<string>();
  const out: CatalogSong[] = [];
  for (const r of recordings) {
    if (r.video) continue;
    const artist = (r["artist-credit"] ?? []).map((a) => a.name + (a.joinphrase ?? "")).join("").trim();
    // MusicBrainz lists the same song once per recording; keep the best-scored one.
    const key = `${normalizeName(r.title)}|${normalizeName(artist)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const release = (r.releases ?? []).find((x) => x.status === "Official") ?? r.releases?.[0];
    const year = release?.date ? Number(release.date.slice(0, 4)) : undefined;
    out.push({
      source: "musicbrainz",
      mbid: r.id,
      title: r.title,
      artist,
      album: release?.title,
      duration: r.length ? Math.round(r.length / 1000) : undefined,
      year: year && Number.isFinite(year) ? year : undefined,
      artwork: release ? `https://coverartarchive.org/release/${release.id}/front-250` : undefined,
    });
  }
  return out;
}

export async function searchMusicBrainz(term: string, limit = 15): Promise<CatalogSong[]> {
  // Escape Lucene query syntax so titles with punctuation search as plain words.
  const q = plainQuery(term).replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
  if (!q) return [];
  const url = `https://musicbrainz.org/ws/2/recording?${new URLSearchParams({ query: q, fmt: "json", limit: String(limit * 2) })}`;
  const data = await fetchJson<{ recordings?: MBRecording[] }>(url, { headers: { Accept: "application/json" } });
  return fromMusicBrainz(data.recordings ?? []).slice(0, limit);
}

export interface CatalogResult {
  songs: CatalogSong[];
  source: CatalogName;
  /** Set when Apple couldn't be reached and the results came from the fallback. */
  appleFailed?: boolean;
}

/** Apple first; MusicBrainz if Apple can't be reached. Rejects only if both fail. */
export async function searchCatalogs(term: string): Promise<CatalogResult> {
  try {
    return { songs: await searchAppleCatalog(term), source: "apple" };
  } catch {
    try {
      return { songs: await searchMusicBrainz(term), source: "musicbrainz", appleFailed: true };
    } catch {
      throw new Error("Couldn't reach Apple Music or MusicBrainz");
    }
  }
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
export function findExisting<T extends { appleId?: number; mbid?: string; title: string; artist: string }>(
  songs: T[],
  c: CatalogSong,
): T | undefined {
  const title = normalizeName(c.title);
  const artist = normalizeName(c.artist);
  return (
    (c.appleId !== undefined ? songs.find((s) => s.appleId === c.appleId) : undefined) ??
    (c.mbid ? songs.find((s) => s.mbid === c.mbid) : undefined) ??
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
