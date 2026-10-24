import { useEffect, useMemo, useRef } from "react";
import { tabMeasures } from "../lib/parser";
import { useMetronome } from "../lib/hooks";
import { transposeChord } from "../lib/music";
import type { TabMode } from "../lib/storage";

export const PRACTICE_SPEEDS = [0.5, 0.75, 1];

export interface TabPlayback {
  row: number;
  /** performance.now() time at which bar 1 starts. */
  start: number;
  bpm: number;
  beatsPerBar: number;
  /** Repeat the section until stopped instead of playing it once. */
  loop: boolean;
}

interface Props {
  lines: string[];
  chords?: { col: number; chord: string }[];
  transpose: number;
  onChordClick?: (chord: string) => void;
  timing: boolean;
  mode: TabMode;
  practiceSpeed: number;
  onModeChange: (mode: TabMode) => void;
  onPracticeSpeedChange: (speed: number) => void;
  playback: TabPlayback | null;
  onPlay: () => void;
  onStop: () => void;
  onDone: () => void;
}

export function TabBlock({
  lines, chords, transpose, onChordClick, timing, mode, practiceSpeed, onModeChange, onPracticeSpeedChange,
  playback, onPlay, onStop, onDone,
}: Props) {
  const measures = useMemo(() => tabMeasures(lines), [lines]);
  const metro = useMetronome();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const canTime = timing && measures.length > 0;

  useEffect(() => {
    if (!playback || !canTime) return;
    const { start, bpm, beatsPerBar, loop } = playback;
    const msPerBeat = 60000 / bpm;
    const totalBeats = measures.length * beatsPerBar;
    let raf = 0;

    const tick = () => {
      const elapsed = (performance.now() - start) / msPerBeat;
      const cursor = cursorRef.current!;
      if (elapsed >= totalBeats && !loop) {
        onDoneRef.current();
        return;
      }
      // Looping restarts on a bar line, so it stays in step with the metronome.
      const pass = elapsed > 0 ? Math.floor(elapsed / totalBeats) : 0;
      const beat = elapsed - pass * totalBeats;
      if (beat < 0) {
        // Count-in bar: the cursor waits at the start of bar 1.
        const left = Math.ceil(-beat);
        labelRef.current!.textContent = `Count-in… ${left}`;
        fillRef.current!.style.width = "0%";
        cursor.style.left = `${measures[0].start + 1}ch`;
        cursor.classList.add("waiting");
      } else {
        const bar = Math.floor(beat / beatsPerBar);
        const frac = (beat - bar * beatsPerBar) / beatsPerBar;
        const m = measures[bar];
        const col = m.start + 1 + frac * (m.end - m.start - 1);
        cursor.style.left = `${col}ch`;
        cursor.classList.remove("waiting");
        fillRef.current!.style.width = `${(beat / totalBeats) * 100}%`;
        labelRef.current!.textContent =
          (loop ? `Loop ${pass + 1} · ` : "") +
          `Bar ${bar + 1}/${measures.length} · Beat ${Math.floor(beat % beatsPerBar) + 1}`;
        // Keep the cursor in view when the tab is wider than the screen.
        const box = scrollRef.current!;
        const x = cursor.offsetLeft;
        if (x < box.scrollLeft + 24 || x > box.scrollLeft + box.clientWidth - 48) {
          box.scrollLeft = Math.max(0, x - box.clientWidth / 3);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (fillRef.current) fillRef.current.style.width = "0%";
    };
  }, [playback, canTime, measures]);

  const playing = !!playback && canTime;

  return (
    <div className={"tab-block" + (playing ? " playing" : "")}>
      {canTime && (
        <div className="tab-transport">
          <button type="button" className="tab-play" onClick={playing ? onStop : onPlay}
            aria-label={playing ? "Stop tab playback" : "Play tab in time"}>
            {playing ? "■" : "▶"}
          </button>
          <div className="tab-progress" aria-hidden>
            <div className="tab-progress-fill" ref={fillRef} />
          </div>
          <span className="tab-label" ref={labelRef}>
            {playing ? "" : `${measures.length} bar${measures.length > 1 ? "s" : ""} · ${metro.bpm} BPM`}
          </span>
        </div>
      )}
      {canTime && (
        <div className="tab-options">
          <div className="segmented" role="group" aria-label="Tab playback mode">
            <button type="button" className={mode === "song" ? "selected" : ""} onClick={() => onModeChange("song")}
              title="Play once as part of the song; autoscroll pauses here while it plays">
              Song
            </button>
            <button type="button" className={mode === "loop" ? "selected" : ""} onClick={() => onModeChange("loop")}
              title="Repeat just this section to practice it; autoscroll skips past">
              ⟲ Loop
            </button>
          </div>
          {mode === "loop" && (
            <div className="segmented" role="group" aria-label="Practice tempo">
              {PRACTICE_SPEEDS.map((s) => (
                <button key={s} type="button" className={practiceSpeed === s ? "selected" : ""}
                  onClick={() => onPracticeSpeedChange(s)}>
                  {s * 100}%
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="tab-scroll" ref={scrollRef}>
        {chords && (
          <div className="tab-chords">
            {chords.map(({ col, chord }) => {
              const shown = transposeChord(chord, transpose);
              return (
                <button key={col} type="button" className="chord" style={{ left: `${col}ch` }}
                  onClick={() => onChordClick?.(shown)}>
                  {shown}
                </button>
              );
            })}
          </div>
        )}
        <pre className="sheet-tab">{lines.join("\n")}</pre>
        {playing && <div className="tab-cursor waiting" ref={cursorRef} />}
      </div>
    </div>
  );
}
