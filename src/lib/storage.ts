import { useCallback, useSyncExternalStore } from "react";
import { BUILT_IN_SONGS } from "../data/songs";

export interface Song {
  id: string;
  title: string;
  artist: string;
  key?: string;
  capo?: number;
  /** Beats per minute, used to preset the metronome. */
  tempo?: number;
  beatsPerBar?: number;
  /** One bar of strumming, e.g. "D - D U - U D U" (D down, U up, - skip, x muted). */
  strum?: string;
  /** Song length in seconds, used by "fit scroll to song length". */
  duration?: number;
  body: string;
  builtIn?: boolean;
  updatedAt?: number;
}

export interface SongPrefs {
  transpose: number;
  /** Autoscroll speed, 1–10 (fractional steps allowed). */
  scrollSpeed: number;
  fontSize: number;
  /** YouTube link for a recording to play along with. */
  videoUrl?: string;
  /** Where the song's first and last lines fall in the recording, in seconds. */
  videoStart?: number;
  videoEnd?: number;
  /** Playback speed of the recording (0.5–1). */
  videoRate?: number;
  /** Apple Music link for the song, opened in the Music app. */
  appleMusicUrl?: string;
}

export const DEFAULT_PREFS: SongPrefs = { transpose: 0, scrollSpeed: 3, fontSize: 16 };

const KEYS = {
  songs: "fretboard.songs",
  favorites: "fretboard.favorites",
  prefs: "fretboard.prefs",
  theme: "fretboard.theme",
  settings: "fretboard.settings",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): changes last for this session only.
  }
  emit();
}

// Tiny store so every component re-renders when saved data changes.
const subscribers = new Set<() => void>();
let version = 0;
function emit() {
  version++;
  subscribers.forEach((fn) => fn());
}
function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

function userSongs(): Song[] {
  return read<Song[]>(KEYS.songs, []);
}

export function getSongs(): Song[] {
  const mine = userSongs();
  const overridden = new Set(mine.map((s) => s.id));
  return [...mine, ...BUILT_IN_SONGS.filter((s) => !overridden.has(s.id))];
}

export function getSong(id: string): Song | undefined {
  return getSongs().find((s) => s.id === id);
}

export function saveSong(song: Song): Song {
  const saved = { ...song, builtIn: false, updatedAt: Date.now() };
  const mine = userSongs().filter((s) => s.id !== song.id);
  write(KEYS.songs, [saved, ...mine]);
  return saved;
}

export function deleteSong(id: string): void {
  write(KEYS.songs, userSongs().filter((s) => s.id !== id));
}

export function newSongId(): string {
  return "song-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getFavorites(): string[] {
  return read<string[]>(KEYS.favorites, []);
}

export function toggleFavorite(id: string): void {
  const favs = getFavorites();
  write(KEYS.favorites, favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]);
}

export function getPrefs(id: string): SongPrefs {
  return { ...DEFAULT_PREFS, ...read<Record<string, Partial<SongPrefs>>>(KEYS.prefs, {})[id] };
}

export function useSongPrefs(id: string): [SongPrefs, (patch: Partial<SongPrefs>) => void] {
  useStoreVersion();
  const prefs = getPrefs(id);
  const update = useCallback(
    (patch: Partial<SongPrefs>) => {
      const all = read<Record<string, Partial<SongPrefs>>>(KEYS.prefs, {});
      write(KEYS.prefs, { ...all, [id]: { ...getPrefs(id), ...patch } });
    },
    [id],
  );
  return [prefs, update];
}

export type Theme = "dark" | "light";
export function getTheme(): Theme {
  return read<Theme>(KEYS.theme, "dark");
}
export function setTheme(theme: Theme): void {
  write(KEYS.theme, theme);
}

export interface PlaySettings {
  /** Highlight the line you're on and dim the lines already played. */
  highlight: boolean;
  /** Show a timed cursor and progress bar on tab blocks. */
  tabTiming: boolean;
  /** "song": a tab plays once as part of the song. "loop": it repeats on its own for practice. */
  tabMode: TabMode;
  /** Tempo multiplier used when looping a tab for practice. */
  practiceSpeed: number;
  /** Scroll the song (and its highlight) in step with a linked recording. */
  videoSync: boolean;
}

export type TabMode = "song" | "loop";

const DEFAULT_SETTINGS: PlaySettings = { highlight: true, tabTiming: true, tabMode: "song", practiceSpeed: 1, videoSync: true };

export function useSettings(): [PlaySettings, (patch: Partial<PlaySettings>) => void] {
  useStoreVersion();
  const settings = { ...DEFAULT_SETTINGS, ...read<Partial<PlaySettings>>(KEYS.settings, {}) };
  const update = useCallback(
    (patch: Partial<PlaySettings>) =>
      write(KEYS.settings, { ...DEFAULT_SETTINGS, ...read<Partial<PlaySettings>>(KEYS.settings, {}), ...patch }),
    [],
  );
  return [settings, update];
}
