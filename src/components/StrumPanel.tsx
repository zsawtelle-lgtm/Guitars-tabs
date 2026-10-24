import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { parseStrum, strumCounts, strumPlayer, type Stroke } from "../lib/strum";
import { metronome } from "../lib/metronome";
import { notifyMetronome, useMetronome } from "../lib/hooks";
import { setMetronome } from "./MetronomePanel";

const GLYPH: Record<Stroke, string> = { D: "↓", U: "↑", "-": "·", x: "✕" };
const LABEL: Record<Stroke, string> = { D: "Down", U: "Up", "-": "Skip", x: "Muted" };

// Re-render when the shared player starts or stops.
const subs = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  subs.forEach((fn) => fn());
};
function usePlayerVersion() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => version,
  );
}

/** Stops the strum loop (e.g. when a tab starts playing with the metronome). */
export function stopStrum() {
  if (!strumPlayer.running) return;
  strumPlayer.stop();
  notify();
}

interface Props {
  pattern: string;
  beatsPerBar: number;
  /** Chords to choose from (already transposed). */
  chords: string[];
}

export function StrumPanel({ pattern, beatsPerBar, chords }: Props) {
  usePlayerVersion();
  const metro = useMetronome();
  const parsed = useMemo(() => parseStrum(pattern, beatsPerBar), [pattern, beatsPerBar]);
  const counts = useMemo(() => (parsed ? strumCounts(parsed) : []), [parsed]);
  const [chord, setChord] = useState(chords[0] ?? "C");
  const [click, setClick] = useState(true);
  const [current, setCurrent] = useState(-1);
  const playing = strumPlayer.running;

  // Keep the player in step with the controls; tempo changes apply on the next stroke.
  strumPlayer.pattern = parsed;
  strumPlayer.bpm = metro.bpm;
  strumPlayer.beatsPerBar = beatsPerBar;
  strumPlayer.chord = chords.includes(chord) ? chord : (chords[0] ?? "C");
  strumPlayer.click = click;

  useEffect(() => strumPlayer.onStroke(setCurrent), []);
  // Stop when leaving the song.
  useEffect(
    () => () => {
      strumPlayer.stop();
      notify();
    },
    [],
  );

  if (!parsed) return null;

  const toggle = () => {
    if (strumPlayer.running) {
      strumPlayer.stop();
    } else {
      // The strum loop has its own click, so don't double up with the metronome.
      if (metronome.running) {
        metronome.stop();
        notifyMetronome();
      }
      strumPlayer.start();
    }
    notify();
  };

  return (
    <section className={"strum-card" + (playing ? " playing" : "")} aria-label="Strumming pattern">
      <div className="strum-head">
        <button type="button" className="tab-play strum-play" onClick={toggle}
          aria-label={playing ? "Stop strumming pattern" : "Play strumming pattern"}>
          {playing ? "■" : "▶"}
        </button>
        <span className="strum-title">Strumming</span>
        <div className="stepper strum-bpm">
          <button className="icon-btn" onClick={() => setMetronome({ bpm: metro.bpm - 5 })} aria-label="Slower">−</button>
          <span className="stepper-value">{metro.bpm}</span>
          <button className="icon-btn" onClick={() => setMetronome({ bpm: metro.bpm + 5 })} aria-label="Faster">+</button>
        </div>
        <span className="muted strum-unit">BPM</span>
        <label className="field-inline">
          <input type="checkbox" checked={click} onChange={(e) => setClick(e.target.checked)} />
          Click
        </label>
      </div>

      <div className="strum-pattern" style={{ ["--per-beat" as string]: parsed.perBeat }}>
        {parsed.strokes.map((s, i) => (
          <div key={i} title={LABEL[s]}
            className={`stroke stroke-${s === "-" ? "rest" : s}` + (i === current ? " on" : "") +
              (i % parsed.perBeat === 0 ? " beat" : "")}>
            <span className="stroke-glyph">{GLYPH[s]}</span>
            <span className="stroke-count">{counts[i]}</span>
          </div>
        ))}
      </div>

      {chords.length > 1 && (
        <div className="strum-chords">
          <span className="muted">Chord:</span>
          {chords.map((c) => (
            <button key={c} type="button" className={"chord-pill" + (c === strumPlayer.chord ? " selected" : "")}
              onClick={() => setChord(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
