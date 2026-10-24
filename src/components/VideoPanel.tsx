import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { loadYouTubeApi, parseYouTubeId, youTubeSearchUrl, type YTPlayer } from "../lib/youtube";
import type { SongPrefs } from "../lib/storage";
import { formatTime } from "../lib/time";

const RATES = [0.5, 0.75, 1];

interface Props {
  title: string;
  artist: string;
  prefs: SongPrefs;
  setPrefs: (patch: Partial<SongPrefs>) => void;
  sync: boolean;
  onSyncChange: (sync: boolean) => void;
  /** Filled with the player once it's ready, so the song page can drive it. */
  playerRef: MutableRefObject<YTPlayer | null>;
  onPlayingChange: (playing: boolean) => void;
}

export function VideoPanel({ title, artist, prefs, setPrefs, sync, onSyncChange, playerRef, onPlayingChange }: Props) {
  const videoId = parseYouTubeId(prefs.videoUrl);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [docked, setDocked] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const rate = prefs.videoRate ?? 1;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const onPlayingRef = useRef(onPlayingChange);
  onPlayingRef.current = onPlayingChange;

  // Create the YouTube player for the linked video.
  useEffect(() => {
    if (!videoId || !mountRef.current) return;
    let player: YTPlayer | null = null;
    let cancelled = false;
    setError(null);
    setReady(false);
    const host = document.createElement("div");
    mountRef.current.appendChild(host);
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(host, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: (e) => {
              playerRef.current = e.target;
              e.target.setPlaybackRate(rateRef.current);
              setReady(true);
            },
            onStateChange: (e) => {
              const isPlaying = e.data === YT.PlayerState.PLAYING;
              setPlaying(isPlaying);
              onPlayingRef.current(isPlaying);
            },
            onError: (e) =>
              setError(
                e.data === 101 || e.data === 150
                  ? "This video's owner doesn't allow it to be played on other sites. Try another upload of the song."
                  : "This video can't be played. Check the link or try another upload.",
              ),
          },
        });
      })
      .catch(() => setError("Couldn't load YouTube. Check your connection or any content blocker."));
    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
      onPlayingRef.current(false);
      setPlaying(false);
      host.remove();
    };
  }, [videoId, playerRef]);

  useEffect(() => {
    if (ready) playerRef.current?.setPlaybackRate(rate);
  }, [rate, ready, playerRef]);

  // On wide screens, keep the video in view (docked in the corner) once you scroll past it.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !videoId) return;
    const io = new IntersectionObserver(([entry]) => setDocked(!entry.isIntersecting));
    io.observe(slot);
    return () => io.disconnect();
  }, [videoId]);

  if (!videoId) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!parseYouTubeId(draft)) {
        setError("That doesn't look like a YouTube link.");
        return;
      }
      setError(null);
      setPrefs({ videoUrl: draft.trim(), videoStart: undefined, videoEnd: undefined });
      setDraft("");
    };
    return (
      <section className="video-card empty">
        <form className="video-add" onSubmit={submit}>
          <span className="strum-title">Play along with a recording</span>
          <input className="search" value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a YouTube link…" aria-label="YouTube link" />
          <button className="btn primary" type="submit">Add</button>
          <a className="btn" href={youTubeSearchUrl(title, artist)} target="_blank" rel="noreferrer">
            Search YouTube ↗
          </a>
        </form>
        {error && <p className="video-error">{error}</p>}
      </section>
    );
  }

  const now = () => playerRef.current?.getCurrentTime() ?? 0;
  const start = prefs.videoStart ?? 0;
  const end = prefs.videoEnd;

  return (
    <section className="video-card">
      <div className="video-head">
        <span className="strum-title">Recording</span>
        <div className="segmented" role="group" aria-label="Playback speed">
          {RATES.map((r) => (
            <button key={r} type="button" className={rate === r ? "selected" : ""} onClick={() => setPrefs({ videoRate: r })}>
              {r}×
            </button>
          ))}
        </div>
        <label className="field-inline" title="Scroll the song and its highlight along with the recording">
          <input type="checkbox" checked={sync} onChange={(e) => onSyncChange(e.target.checked)} />
          Sync scroll
        </label>
        <button type="button" className="btn video-remove"
          onClick={() => setPrefs({ videoUrl: undefined, videoStart: undefined, videoEnd: undefined })}>
          Remove
        </button>
      </div>

      <div className="video-slot" ref={slotRef}>
        <div className={"video-frame" + (docked && playing ? " docked" : "")} ref={mountRef} />
      </div>

      {error && <p className="video-error">{error}</p>}

      {sync && (
        <div className="video-marks">
          <span className="muted">Lyrics run from</span>
          <button type="button" className="btn" disabled={!ready} onClick={() => setPrefs({ videoStart: Math.floor(now()) })}
            title="Set to the current position in the video">
            {formatTime(start)} ⟲ now
          </button>
          <span className="muted">to</span>
          <button type="button" className="btn" disabled={!ready} onClick={() => setPrefs({ videoEnd: Math.ceil(now()) })}
            title="Set to the current position in the video">
            {end !== undefined ? formatTime(end) : "end"} ⟲ now
          </button>
          {(prefs.videoStart !== undefined || end !== undefined) && (
            <button type="button" className="btn" onClick={() => setPrefs({ videoStart: undefined, videoEnd: undefined })}>
              Reset
            </button>
          )}
        </div>
      )}
    </section>
  );
}
