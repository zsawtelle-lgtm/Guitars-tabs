import { useRef } from "react";
import { metronome, tapTempo } from "../lib/metronome";
import { notifyMetronome, useBeat, useMetronome } from "../lib/hooks";

type MetroSettings = Partial<Pick<typeof metronome, "bpm" | "beatsPerBar" | "accent" | "volume">>;

export function setMetronome(patch: MetroSettings) {
  if (patch.bpm !== undefined) patch.bpm = Math.round(Math.min(300, Math.max(30, patch.bpm)));
  Object.assign(metronome, patch);
  notifyMetronome();
}

export function toggleMetronome() {
  metronome.toggle();
  notifyMetronome();
}

export function MetronomePanel({ compact = false }: { compact?: boolean }) {
  const m = useMetronome();
  const beat = useBeat();
  const taps = useRef<number[]>([]);

  const tap = () => {
    const now = performance.now();
    // Start a fresh measurement after a 2 second pause.
    if (taps.current.length && now - taps.current[taps.current.length - 1] > 2000) taps.current = [];
    taps.current = [...taps.current, now].slice(-6);
    const bpm = tapTempo(taps.current);
    if (bpm) setMetronome({ bpm });
  };

  return (
    <div className={"metronome" + (compact ? " compact" : "")}>
      <div className="beat-dots" aria-hidden>
        {Array.from({ length: m.beatsPerBar }, (_, i) => (
          <span key={i} className={"beat-dot" + (beat === i ? " on" : "") + (i === 0 && m.accent ? " accent" : "")} />
        ))}
      </div>

      <div className="bpm-row">
        <button className="icon-btn" onClick={() => setMetronome({ bpm: m.bpm - 5 })} aria-label="Slower by 5">−5</button>
        <button className="icon-btn" onClick={() => setMetronome({ bpm: m.bpm - 1 })} aria-label="Slower by 1">−</button>
        <div className="bpm-display">
          <span className="bpm-value">{m.bpm}</span>
          <span className="bpm-label">BPM</span>
        </div>
        <button className="icon-btn" onClick={() => setMetronome({ bpm: m.bpm + 1 })} aria-label="Faster by 1">+</button>
        <button className="icon-btn" onClick={() => setMetronome({ bpm: m.bpm + 5 })} aria-label="Faster by 5">+5</button>
      </div>

      <input
        type="range" min={30} max={300} value={m.bpm} className="slider"
        aria-label="Tempo"
        onChange={(e) => setMetronome({ bpm: Number(e.target.value) })}
      />

      <div className="metro-controls">
        <button className={"btn primary play-btn" + (m.running ? " active" : "")} onClick={toggleMetronome}>
          {m.running ? "■ Stop" : "▶ Start"}
        </button>
        <button className="btn" onClick={tap}>Tap tempo</button>
        <label className="field-inline">
          Beats
          <select value={m.beatsPerBar} onChange={(e) => setMetronome({ beatsPerBar: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <input type="checkbox" checked={m.accent} onChange={(e) => setMetronome({ accent: e.target.checked })} />
          Accent
        </label>
        {!compact && (
          <label className="field-inline">
            Volume
            <input type="range" min={0} max={1} step={0.05} value={m.volume}
              onChange={(e) => setMetronome({ volume: Number(e.target.value) })} />
          </label>
        )}
      </div>
    </div>
  );
}
