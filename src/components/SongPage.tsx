import { useCallback, useEffect, useMemo, useState } from "react";
import { chordsInSong, parseSong } from "../lib/parser";
import { transposeChord } from "../lib/music";
import { getFavorites, toggleFavorite, useSongPrefs, useStoreVersion, type Song } from "../lib/storage";
import { pxPerSecToSpeed, speedToPxPerSec, useAutoScroll, useMetronome, useWakeLock } from "../lib/hooks";
import { SongSheet } from "./SongSheet";
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

  const lines = useMemo(() => parseSong(song.body), [song.body]);
  const chords = useMemo(
    () => [...new Set(chordsInSong(lines).map((c) => transposeChord(c, prefs.transpose)))],
    [lines, prefs.transpose],
  );
  const favorite = getFavorites().includes(song.id);

  const pxPerSec = speedToPxPerSec(prefs.scrollSpeed) * (prefs.fontSize / 16);
  useAutoScroll(scrolling, pxPerSec, () => setScrolling(false));
  useWakeLock(scrolling || metro.running);

  // Preset the metronome to this song's tempo unless it's already clicking.
  useEffect(() => {
    if (!metro.running && song.tempo) setMetronome({ bpm: song.tempo, beatsPerBar: song.beatsPerBar ?? 4 });
    window.scrollTo(0, 0);
  }, [song.id]);

  const setSpeed = useCallback((s: number) => setPrefs({ scrollSpeed: clampSpeed(s) }), [setPrefs]);

  const toggleScroll = useCallback(() => {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    // Pressing play at the end starts the song over.
    if (!scrolling && atBottom) window.scrollTo(0, 0);
    setScrolling(!scrolling);
  }, [scrolling]);

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
      if (t.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
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

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const shownKey = song.key ? transposeChord(song.key, prefs.transpose) : undefined;
  const closePopover = useCallback(() => setPopover(null), []);

  return (
    <div className="song-page">
      <header className="song-header">
        <div className="song-title-row">
          <div>
            <h1>{song.title}</h1>
            <div className="song-artist">{song.artist}</div>
          </div>
          <div className="song-actions">
            <button className={"icon-btn star" + (favorite ? " on" : "")} onClick={() => toggleFavorite(song.id)}
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"} title="Favorite">
              {favorite ? "★" : "☆"}
            </button>
            <a className="btn" href={`#/edit/${encodeURIComponent(song.id)}`}>Edit</a>
          </div>
        </div>
        <dl className="song-meta">
          {shownKey && (<><dt>Key</dt><dd>{shownKey}{prefs.transpose !== 0 && <span className="muted"> (orig. {song.key})</span>}</dd></>)}
          {song.capo ? (<><dt>Capo</dt><dd>{song.capo}{ordinal(song.capo)} fret</dd></>) : null}
          {song.tempo ? (<><dt>Tempo</dt><dd>{song.tempo} BPM</dd></>) : null}
          {song.beatsPerBar ? (<><dt>Time</dt><dd>{song.beatsPerBar}/4</dd></>) : null}
        </dl>
      </header>

      {showChords && <ChordStrip chords={chords} onSelect={setPopover} />}

      <SongSheet lines={lines} transpose={prefs.transpose} fontSize={prefs.fontSize} onChordClick={setPopover} />
      <div className="sheet-end">— End —</div>

      <div className="toolbar-wrap">
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
                <span className="panel-label">Text size</span>
                <Stepper value={`${prefs.fontSize}px`} onDec={() => setPrefs({ fontSize: Math.max(11, prefs.fontSize - 1) })}
                  onInc={() => setPrefs({ fontSize: Math.min(32, prefs.fontSize + 1) })} />
                <label className="field-inline">
                  <input type="checkbox" checked={showChords} onChange={(e) => setShowChords(e.target.checked)} />
                  Chord diagrams
                </label>
              </div>
            )}
            {panel === "metronome" && <MetronomePanel compact />}
          </div>
        )}

        <nav className="toolbar" aria-label="Song tools">
          <div className="tool-group">
            <button className={"scroll-btn" + (scrolling ? " active" : "")} onClick={toggleScroll}
              aria-label={scrolling ? "Pause autoscroll" : "Start autoscroll"} title="Autoscroll (Space)">
              {scrolling ? "❚❚" : "▶"}
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
            <ToolButton label="Text" value="Aa" selected={panel === "text"} onClick={() => togglePanel("text")} />
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
export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
