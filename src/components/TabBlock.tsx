import { useEffect, useMemo, useRef } from "react";
import { tabMeasures } from "../lib/parser";
import { useMetronome } from "../lib/hooks";
import { transposeChord } from "../lib/music";

export interface TabPlayback {
  row: number;
  /** performance.now() time at which bar 1 starts. */
  start: number;
  bpm: number;
  beatsPerBar: number;
}

interface Props {
  lines: string[];
  chords?: { col: number; chord: string }[];
  transpose: number;
  onChordClick?: (chord: string) => void;
  timing: boolean;
  playback: TabPlayback | null;
  onPlay: () => void;
  onStop: () => void;
  onDone: () => void;
}

export function TabBlock({ lines, chords, transpose, onChordClick, timing, playback, onPlay, onStop, onDone }: Props) {
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
    const { start, bpm, beatsPerBar } = playback;
    const msPerBeat = 60000 / bpm;
    const totalBeats = measures.length * beatsPerBar;
    let raf = 0;

    const tick = () => {
      const beat = (performance.now() - start) / msPerBeat;
      const cursor = cursorRef.current!;
      if (beat >= totalBeats) {
        onDoneRef.current();
        return;
      }
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
