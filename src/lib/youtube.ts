// YouTube IFrame Player API: loading it and pulling video IDs out of links.

/** Extracts the 11-character video ID from any common YouTube link (or a bare ID). */
export function parseYouTubeId(input: string | undefined): string | null {
  const text = input?.trim();
  if (!text) return null;
  if (/^[\w-]{11}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text.includes("://") ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v");
    const m = /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(url.pathname);
    if (!id && m) id = m[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Search results page for a song, for finding a recording to link. */
export function youTubeSearchUrl(title: string, artist: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist}`.trim())}`;
}

// Minimal typings for the parts of the player API we use.
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

export interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the YouTube player"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
