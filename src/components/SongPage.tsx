import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chordsInSong, groupRows, isContentRow, parseSong } from "../lib/parser";
import { transposeChord } from "../lib/music";
import {
  getFavorites, setImportTarget, toggleFavorite, useSettings, useSongPrefs, useStoreVersion, type Song, type TabMode,
} from "../lib/storage";
import { notifyMetronome, pxPerSecToSpeed, speedToPxPerSec, useAutoScroll, useMetronome, useWakeLock } from "../lib/hooks";
import { metronome } from "../lib/metronome";
import type { TabPlayback } from "./TabBlock";
import { SongSheet } from "./SongSheet";
import { StrumPanel, stopStrum } from "./StrumPanel";
import { VideoPanel } from "./VideoPanel";
import { AppleMusicRow } from "./AppleMusicRow";
import { parseAppleMusicUrl } from "../lib/appleMusic";
import { chordSearchLinks } from "../lib/catalog";
import { formatTime } from "../lib/time";
import { parseYouTubeId, type YTPlayer } from "../lib/youtube";
import { ChordPopover, ChordStrip } from "./ChordViews";
import { MetronomePanel, setMetronome, toggleMetronome } from "./MetronomePanel";

type Panel = "speed" | "transpose" | "text" | "metronome" | null;

const MIN_SPEED = 0.5;
const MAX_SPEED = 10;
const clampSpeed = (s: number) => Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, s)) * 10) / 10;

export function SongPage({ song }: { song: Song }) {
  useStoreVersion();
  const [prefs, setPrefs] = useSongPrefs(song.id);
  const [scrolling, setScrolling] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [showChords, setShowChords] = useState(true);
  const [popover, setPopover] = useState<string | null>(null);
  const metro = useMetronome();

  const [settings, setSettings] = useSettings();
  const lines = useMemo(() => parseSong(song.body), [song.body]);
  const rows = useMemo(() => groupRows(lines), [lines]);
  const chords = useMemo(
    () => [...new Set(chordsInSong(lines).map((c) => transposeChord(c, prefs.transpose)))],
    [lines, prefs.transpose],
  );
  const favorite = getFavorites().includes(song.id);

  const [activeRow, setActiveRow] = useState(-1);
  const [tabPlay, setTabPlay] = useState<TabPlayback | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const playedTabs = useRef(new Set<number>());
  const progressRef = useRef<HTMLDivElement>(null);
  // Where the focus point sits inside the current row (0 = top, 1 = bottom).
  const focusRef = useRef({ row: -1, frac: 0 });
  const shownRowRef = useRef(-1);
  const highlightRef = useRef(settings.highlight);
  highlightRef.current = settings.highlight;
  const litWordRef = useRef("");

  // Highlights the word you're on in the current line, and marks the words before it
  // as sung. Words advance as the focus point moves down through the line.
  const applyWordHighlight = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const row = shownRowRef.current;
    const el = highlightRef.current ? sheet.querySelector(`[data-row="${row}"]`) : null;
    const words = el ? [...el.querySelectorAll<HTMLElement>(".word[data-w]")] : [];
    const frac = focusRef.current.row === row ? focusRef.current.frac : 0;
    const now = words.length ? Math.min(words.length - 1, Math.floor(frac * words.length)) : -1;
    const key = `${row}:${now}:${words.length}`;
    if (key === litWordRef.current) return;
    litWordRef.current = key;
    sheet.querySelectorAll(".word.now, .word.sung").forEach((w) => w.classList.remove("now", "sung"));
    words.forEach((w, i) => {
      if (i < now) w.classList.add("sung");
      else if (i === now) w.classList.add("now");
    });
  }, []);

  // A linked recording, when playing with sync on, drives the scroll instead of autoscroll.
  const playerRef = useRef<YTPlayer | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const hasVideo = !!parseYouTubeId(prefs.videoUrl);
  const videoDriven = hasVideo && settings.videoSync;
  const onVideoPlaying = useCallback((playing: boolean) => {
    setVideoPlaying(playing);
    if (!playing) return;
    // Clicks and the strum loop won't line up with a recording, so silence them.
    setScrolling(false);
    stopStrum();
    if (metronome.running) {
      metronome.stop();
      notifyMetronome();
    }
  }, []);

  useEffect(() => {
    if (!videoPlaying || !settings.videoSync) return;
    let raf = 0;
    const follow = () => {
      const player = playerRef.current;
      if (player) {
        const start = prefs.videoStart ?? 0;
        const end = prefs.videoEnd ?? player.getDuration();
        const progress = end > start ? Math.min(1, Math.max(0, (player.getCurrentTime() - start) / (end - start))) : 0;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, progress * maxScroll);
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [videoPlaying, settings.videoSync, prefs.videoStart, prefs.videoEnd]);

  const pxPerSec = speedToPxPerSec(prefs.scrollSpeed) * (prefs.fontSize / 16);
  // Autoscroll holds while a tab plays, so the tab gets its real time before the song moves on.
  useAutoScroll(scrolling && !(tabPlay && !tabPlay.loop), pxPerSec, () => setScrolling(false));
  useWakeLock(scrolling || metro.running || !!tabPlay || videoPlaying);

  // Track where in the song you are. The focus point moves through the sheet in step
  // with the scroll position, so the first line is current at the top of the page and
  // the last line at the bottom.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      if (progressRef.current) progressRef.current.style.width = `${progress * 100}%`;
      const rect = sheet.getBoundingClientRect();
      const focus = rect.top + progress * rect.height;
      let current = -1;
      let frac = 0;
      for (const el of sheet.querySelectorAll<HTMLElement>("[data-content]")) {
        current = Number(el.dataset.row);
        const r = el.getBoundingClientRect();
        frac = r.height > 0 ? Math.min(1, Math.max(0, (focus - r.top) / r.height)) : 0;
        if (r.bottom >= focus) break;
      }
      focusRef.current = { row: current, frac };
      setActiveRow(current);
      applyWordHighlight();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [rows, prefs.fontSize, showChords, applyWordHighlight]);

  // Once a tab has been played through, "you are here" moves on to the next line
  // rather than waiting for the scroll position to catch up.
  let shownRow = activeRow;
  if (!tabPlay && rows[activeRow]?.kind === "tabblock" && playedTabs.current.has(activeRow)) {
    const next = rows.findIndex((r, i) => i > activeRow && isContentRow(r));
    if (next >= 0) shownRow = next;
  }
  shownRowRef.current = shownRow;
  useEffect(applyWordHighlight, [shownRow, settings.highlight, prefs.transpose, applyWordHighlight]);

  // Tab playback locks onto the metronome: it starts on the next bar (after a
  // count-in bar if the metronome was silent) and stops the click again if it started it.
  // A practice loop below full speed slows the metronome for its duration.
  const startedMetro = useRef(false);
  const savedBpm = useRef<number | null>(null);
  const tabPlayRef = useRef(tabPlay);
  tabPlayRef.current = tabPlay;

  const stopTab = useCallback(() => {
    if (startedMetro.current) {
      metronome.stop();
      startedMetro.current = false;
    }
    if (savedBpm.current !== null) {
      metronome.bpm = savedBpm.current;
      savedBpm.current = null;
    }
    notifyMetronome();
    setTabPlay(null);
  }, []);
  const startTab = useCallback((row: number, loop: boolean, speed = 1) => {
    stopStrum();
    if (loop && speed !== 1) {
      savedBpm.current = metronome.bpm;
      metronome.bpm = Math.max(30, Math.round(metronome.bpm * speed));
    }
    startedMetro.current = !metronome.running;
    const start = metronome.nextDownbeat();
    notifyMetronome();
    setTabPlay({ row, start, bpm: metronome.bpm, beatsPerBar: metronome.beatsPerBar, loop });
  }, []);
  const playTab = useCallback(
    (row: number) => startTab(row, settings.tabMode === "loop", settings.practiceSpeed),
    [startTab, settings.tabMode, settings.practiceSpeed],
  );
  const changeTabMode = useCallback(
    (tabMode: TabMode) => {
      if (tabPlayRef.current) stopTab();
      setSettings({ tabMode });
    },
    [stopTab, setSettings],
  );
  const changePracticeSpeed = useCallback(
    (practiceSpeed: number) => {
      setSettings({ practiceSpeed });
      // Restart a running loop at the new tempo.
      const current = tabPlayRef.current;
      if (current?.loop) {
        stopTab();
        startTab(current.row, true, practiceSpeed);
      }
    },
    [setSettings, stopTab, startTab],
  );
  useEffect(() => () => {
    if (startedMetro.current) metronome.stop();
  }, []);

  // In Song mode, autoscroll plays each tab block once, in time, as the song reaches it.
  // (Loop mode is for practising a section on its own, so autoscroll skips past.)
  useEffect(() => {
    // Scrolling back above a tab lets it play again next time through.
    for (const r of playedTabs.current) if (r > activeRow) playedTabs.current.delete(r);
    if (!scrolling || !settings.tabTiming || settings.tabMode !== "song" || tabPlay) return;
    if (rows[activeRow]?.kind === "tabblock" && !playedTabs.current.has(activeRow)) {
      playedTabs.current.add(activeRow);
      startTab(activeRow, false);
    }
  }, [activeRow, scrolling, settings.tabTiming, settings.tabMode, tabPlay, rows, startTab]);

  // Preset the metronome to this song's tempo unless it's already clicking.
  useEffect(() => {
    if (!metro.running && song.tempo) setMetronome({ bpm: song.tempo, beatsPerBar: song.beatsPerBar ?? 4 });
    window.scrollTo(0, 0);
  }, [song.id]);

  const setSpeed = useCallback((s: number) => setPrefs({ scrollSpeed: clampSpeed(s) }), [setPrefs]);

  const toggleScroll = useCallback(() => {
    // With a synced recording, play/pause controls the recording and the scroll follows it.
    if (videoDriven && playerRef.current) {
      if (videoPlaying) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
      return;
    }
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    // Pressing play at the end starts the song over.
    if (!scrolling && atBottom) window.scrollTo(0, 0);
    setScrolling(!scrolling);
  }, [scrolling, videoDriven, videoPlaying]);

  const fitToDuration = () => {
    if (!song.duration) return;
    const distance = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    const px = distance / song.duration / (prefs.fontSize / 16);
    setSpeed(pxPerSecToSpeed(Math.max(px, 1)));
  };

  // Keyboard shortcuts, handy with a Bluetooth page-turner or laptop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          toggleScroll();
          break;
        case "+":
        case "=":
          setSpeed(prefs.scrollSpeed + 0.5);
          break;
        case "-":
        case "_":
          setSpeed(prefs.scrollSpeed - 0.5);
          break;
        case "]":
          setPrefs({ transpose: prefs.transpose + 1 });
          break;
        case "[":
          setPrefs({ transpose: prefs.transpose - 1 });
          break;
        case "m":
        case "M":
          toggleMetronome();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs, setPrefs, setSpeed, toggleScroll]);

  const appleLink = parseAppleMusicUrl(prefs.appleMusicUrl);
  const moving = scrolling || (videoDriven && videoPlaying);

  // A small scripting hook so something outside the page (e.g. a Mac Shortcut that also
  // presses play in the Music app) can start and stop the song in the same instant.
  useEffect(() => {
    const api = {
      play: () => !moving && toggleScroll(),
      pause: () => moving && toggleScroll(),
      toggle: () => toggleScroll(),
      playing: moving,
    };
    window.fretboard = api;
    return () => {
      if (window.fretboard === api) delete window.fretboard;
    };
  }, [moving, toggleScroll]);
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const shownKey = song.key ? transposeChord(song.key, prefs.transpose) : undefined;
  const closePopover = useCallback(() => setPopover(null), []);

  return (
    <div className="song-page">
      <header className="song-header">
        <div className="song-title-row">
          {song.artwork && <img src={song.artwork} alt="" className="song-art" />}
          <div className="song-title-text">
            <h1>{song.title}</h1>
            <div className="song-artist">{song.artist}{song.album ? <span className="muted"> · {song.album}</span> : null}</div>
          </div>
          <div className="song-actions">
            <button className={"icon-btn star" + (favorite ? " on" : "")} onClick={() => toggleFavorite(song.id)}
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"} title="Favorite">
              {favorite ? "★" : "☆"}
            </button>
            {appleLink && (
              <a className="btn" href={appleLink} target="_blank" rel="noreferrer" title="Open in Apple Music">
                ♫ Apple Music
              </a>
            )}
            <a className="btn" href={`#/edit/${encodeURIComponent(song.id)}`}>Edit</a>
          </div>
        </div>
        <dl className="song-meta">
          {shownKey && (<><dt>Key</dt><dd>{shownKey}{prefs.transpose !== 0 && <span className="muted"> (orig. {song.key})</span>}</dd></>)}
          {song.capo ? (<><dt>Capo</dt><dd>{song.capo}{ordinal(song.capo)} fret</dd></>) : null}
          {song.tempo ? (<><dt>Tempo</dt><dd>{song.tempo} BPM</dd></>) : null}
          {song.beatsPerBar ? (<><dt>Time</dt><dd>{song.beatsPerBar}/4</dd></>) : null}
          {song.duration ? (<><dt>Length</dt><dd>{formatTime(song.duration)}</dd></>) : null}
        </dl>
        <SourceLine song={song} />
      </header>

      {showChords && <ChordStrip chords={chords} onSelect={setPopover} />}

      <AppleMusicRow key={`apple-${song.id}`} title={song.title} artist={song.artist} prefs={prefs} setPrefs={setPrefs} />

      <VideoPanel
        key={song.id}
        title={song.title}
        artist={song.artist}
        prefs={prefs}
        setPrefs={setPrefs}
        sync={settings.videoSync}
        onSyncChange={(videoSync) => setSettings({ videoSync })}
        playerRef={playerRef}
        onPlayingChange={onVideoPlaying}
      />

      {song.strum && (
        <StrumPanel key={song.id} pattern={song.strum} beatsPerBar={song.beatsPerBar ?? 4} chords={chords} />
      )}

      {!lines.length && (
        <div className="chord-source-panel no-chords">
          <div>
            <b>No chords yet</b>
            <p className="muted">
              Find a published chord sheet or tab for this song, then paste it in with <b>Edit</b> and save its link as the
              chord source.
            </p>
            <div className="source-links">
              {chordSearchLinks(song.title, song.artist).map((l) => (
                <a key={l.label} className="btn" href={l.url} target="_blank" rel="noreferrer"
                  onClick={() => setImportTarget(song.id)}>{l.label} ↗</a>
              ))}
              <a className="btn primary" href={`#/edit/${encodeURIComponent(song.id)}`}>Edit →</a>
            </div>
          </div>
        </div>
      )}

      <div ref={sheetRef}>
        <SongSheet
          rows={rows}
          transpose={prefs.transpose}
          fontSize={prefs.fontSize}
          onChordClick={setPopover}
          activeRow={settings.highlight ? shownRow : -1}
          tabTiming={settings.tabTiming}
          tabMode={settings.tabMode}
          practiceSpeed={settings.practiceSpeed}
          onTabModeChange={changeTabMode}
          onPracticeSpeedChange={changePracticeSpeed}
          tabPlayback={tabPlay}
          onTabPlay={playTab}
          onTabStop={stopTab}
          onTabDone={stopTab}
        />
      </div>
      <div className="sheet-end">— End —</div>

      <div className="toolbar-wrap">
        {settings.highlight && (
          <div className="song-progress" aria-hidden>
            <div className="song-progress-fill" ref={progressRef} />
          </div>
        )}
        {panel && (
          <div className="toolbar-panel">
            {panel === "speed" && (
              <div className="panel-row">
                <span className="panel-label">Scroll speed</span>
                <input type="range" className="slider" min={MIN_SPEED} max={MAX_SPEED} step={0.1}
                  value={prefs.scrollSpeed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Scroll speed" />
                {song.duration ? (
                  <button className="btn" onClick={fitToDuration}
                    title={`Set speed so the rest of the song scrolls in ${formatTime(song.duration)}`}>
                    Fit to {formatTime(song.duration)}
                  </button>
                ) : null}
              </div>
            )}
            {panel === "transpose" && (
              <div className="panel-row">
                <span className="panel-label">Transpose</span>
                <Stepper value={signed(prefs.transpose)} onDec={() => setPrefs({ transpose: prefs.transpose - 1 })}
                  onInc={() => setPrefs({ transpose: prefs.transpose + 1 })} />
                <button className="btn" onClick={() => setPrefs({ transpose: 0 })} disabled={!prefs.transpose}>Reset</button>
              </div>
            )}
            {panel === "text" && (
              <div className="panel-row">
                <span className="panel-label">View</span>
                <Stepper value={`${prefs.fontSize}px`} onDec={() => setPrefs({ fontSize: Math.max(11, prefs.fontSize - 1) })}
                  onInc={() => setPrefs({ fontSize: Math.min(32, prefs.fontSize + 1) })} />
                <label className="field-inline">
                  <input type="checkbox" checked={showChords} onChange={(e) => setShowChords(e.target.checked)} />
                  Chord diagrams
                </label>
                <label className="field-inline" title="Highlight the line you're on and show song progress">
                  <input type="checkbox" checked={settings.highlight}
                    onChange={(e) => setSettings({ highlight: e.target.checked })} />
                  Highlight progress
                </label>
                <label className="field-inline" title="Play tab sections in time with a moving cursor">
                  <input type="checkbox" checked={settings.tabTiming}
                    onChange={(e) => {
                      setSettings({ tabTiming: e.target.checked });
                      if (!e.target.checked) stopTab();
                    }} />
                  Tab timing
                </label>
              </div>
            )}
            {panel === "metronome" && <MetronomePanel compact />}
          </div>
        )}

        <nav className="toolbar" aria-label="Song tools">
          <div className="tool-group">
            <button className={"scroll-btn" + (moving ? " active" : "")} onClick={toggleScroll}
              aria-label={videoDriven ? (moving ? "Pause recording" : "Play recording") : moving ? "Pause autoscroll" : "Start autoscroll"}
              title={videoDriven ? "Play / pause the recording (Space)" : "Autoscroll (Space)"}>
              {moving ? "❚❚" : "▶"}
            </button>
            <button className="icon-btn" onClick={() => setSpeed(prefs.scrollSpeed - 0.5)} aria-label="Slower">−</button>
            <button className={"speed-value" + (panel === "speed" ? " selected" : "")} onClick={() => togglePanel("speed")}
              title="Scroll speed">
              <span className="tool-caption">Speed</span>
              {prefs.scrollSpeed.toFixed(1)}
            </button>
            <button className="icon-btn" onClick={() => setSpeed(prefs.scrollSpeed + 0.5)} aria-label="Faster">+</button>
          </div>
          <div className="tool-group">
            <ToolButton label="Transpose" value={signed(prefs.transpose)} selected={panel === "transpose"}
              onClick={() => togglePanel("transpose")} />
            <ToolButton label="View" value="Aa" selected={panel === "text"} onClick={() => togglePanel("text")} />
            <ToolButton label="Metronome" value={metro.running ? `${metro.bpm}` : "♩"} selected={panel === "metronome"}
              active={metro.running} onClick={() => togglePanel("metronome")} />
          </div>
        </nav>
      </div>

      {popover && <ChordPopover chord={popover} onClose={closePopover} />}
    </div>
  );
}

function ToolButton(props: { label: string; value: string; selected: boolean; active?: boolean; onClick: () => void }) {
  return (
    <button className={"tool-btn" + (props.selected ? " selected" : "") + (props.active ? " active" : "")}
      onClick={props.onClick}>
      <span className="tool-value">{props.value}</span>
      <span className="tool-caption">{props.label}</span>
    </button>
  );
}

function Stepper({ value, onDec, onInc }: { value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="stepper">
      <button className="icon-btn" onClick={onDec} aria-label="Decrease">−</button>
      <span className="stepper-value">{value}</span>
      <button className="icon-btn" onClick={onInc} aria-label="Increase">+</button>
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");

declare global {
  interface Window {
    /** Start/stop the open song from outside the page (see the Mac one-key start). */
    fretboard?: { play(): void; pause(): void; toggle(): void; playing: boolean };
  }
}

/** Where the song's details and chords came from, so nothing looks more authoritative than it is. */
function SourceLine({ song }: { song: Song }) {
  if (song.builtIn) {
    return (
      <p className="source-line muted">
        Built-in arrangement of a traditional song. The chords, tempo and strumming were written for this app, not taken
        from a published source.
      </p>
    );
  }
  let host: string | null = null;
  try {
    host = song.chordSource ? new URL(song.chordSource).hostname.replace(/^www\./, "") : null;
  } catch {
    host = null;
  }
  return (
    <p className="source-line">
      {song.appleId ? <span><span className="source-ok">✓</span> Song info from Apple Music</span> : null}
      {host ? (
        <span>
          Chords from{" "}
          <a href={song.chordSource} target="_blank" rel="noreferrer">{host} ↗</a>
        </span>
      ) : song.body.trim() ? (
        <span className="muted">Chord source not recorded (add it in Edit)</span>
      ) : null}
    </p>
  );
}
