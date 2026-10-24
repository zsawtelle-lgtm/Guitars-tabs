import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chordsInSong, groupRows, isContentRow, parseSong } from "../lib/parser";
import { transposeChord } from "../lib/music";
import { getFavorites, toggleFavorite, useSettings, useSongPrefs, useStoreVersion, type Song } from "../lib/storage";
import { notifyMetronome, pxPerSecToSpeed, speedToPxPerSec, useAutoScroll, useMetronome, useWakeLock } from "../lib/hooks";
import { metronome } from "../lib/metronome";
import type { TabPlayback } from "./TabBlock";
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

  const pxPerSec = speedToPxPerSec(prefs.scrollSpeed) * (prefs.fontSize / 16);
  // Autoscroll holds while a tab plays, so the tab gets its real time before the song moves on.
  useAutoScroll(scrolling && !tabPlay, pxPerSec, () => setScrolling(false));
  useWakeLock(scrolling || metro.running || !!tabPlay);

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
      for (const el of sheet.querySelectorAll<HTMLElement>("[data-content]")) {
        current = Number(el.dataset.row);
        if (el.getBoundingClientRect().bottom >= focus) break;
      }
      setActiveRow(current);
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
  }, [rows, prefs.fontSize, showChords]);

  // Once a tab has been played through, "you are here" moves on to the next line
  // rather than waiting for the scroll position to catch up.
  let shownRow = activeRow;
  if (!tabPlay && rows[activeRow]?.kind === "tabblock" && playedTabs.current.has(activeRow)) {
    const next = rows.findIndex((r, i) => i > activeRow && isContentRow(r));
    if (next >= 0) shownRow = next;
  }

  // Tab playback locks onto the metronome: it starts on the next bar (after a
  // count-in bar if the metronome was silent) and stops the click again if it started it.
  const startedMetro = useRef(false);
  const startTab = useCallback((row: number) => {
    startedMetro.current = !metronome.running;
    const start = metronome.nextDownbeat();
    notifyMetronome();
    setTabPlay({ row, start, bpm: metronome.bpm, beatsPerBar: metronome.beatsPerBar });
  }, []);
  const stopTab = useCallback(() => {
    if (startedMetro.current) {
      metronome.stop();
      notifyMetronome();
      startedMetro.current = false;
    }
    setTabPlay(null);
  }, []);
  useEffect(() => () => {
    if (startedMetro.current) metronome.stop();
  }, []);

  // While autoscrolling, play each tab block in time as the song reaches it.
  useEffect(() => {
    // Scrolling back above a tab lets it play again next time through.
    for (const r of playedTabs.current) if (r > activeRow) playedTabs.current.delete(r);
    if (!scrolling || !settings.tabTiming || tabPlay) return;
    if (rows[activeRow]?.kind === "tabblock" && !playedTabs.current.has(activeRow)) {
      playedTabs.current.add(activeRow);
      startTab(activeRow);
    }
  }, [activeRow, scrolling, settings.tabTiming, tabPlay, rows, startTab]);

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

      <div ref={sheetRef}>
        <SongSheet
          rows={rows}
          transpose={prefs.transpose}
          fontSize={prefs.fontSize}
          onChordClick={setPopover}
          activeRow={settings.highlight ? shownRow : -1}
          tabTiming={settings.tabTiming}
          tabPlayback={tabPlay}
          onTabPlay={startTab}
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
export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
