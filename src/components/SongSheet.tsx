import { memo, type ReactNode } from "react";
import { isContentRow, type Row, type Segment } from "../lib/parser";
import { transposeChord } from "../lib/music";
import { TabBlock, type TabPlayback } from "./TabBlock";
import type { TabMode } from "../lib/storage";

interface Props {
  rows: Row[];
  transpose: number;
  fontSize: number;
  onChordClick?: (chord: string) => void;
  /** Row to highlight as "you are here"; -1 for none. Earlier content rows are dimmed. */
  activeRow?: number;
  tabTiming?: boolean;
  tabMode?: TabMode;
  practiceSpeed?: number;
  onTabModeChange?: (mode: TabMode) => void;
  onPracticeSpeedChange?: (speed: number) => void;
  tabPlayback?: TabPlayback | null;
  onTabPlay?: (row: number) => void;
  onTabStop?: () => void;
  onTabDone?: () => void;
}

export const SongSheet = memo(function SongSheet({
  rows, transpose, fontSize, onChordClick, activeRow = -1, tabTiming = false, tabMode = "song", practiceSpeed = 1,
  onTabModeChange, onPracticeSpeedChange, tabPlayback = null, onTabPlay, onTabStop, onTabDone,
}: Props) {
  return (
    <div className="sheet" style={{ fontSize }}>
      {rows.map((row, i) => {
        const content = isContentRow(row);
        const state = !content || activeRow < 0 ? "" : i === activeRow ? " current" : i < activeRow ? " played" : "";
        const rowProps = { "data-row": i, "data-content": content || undefined };
        switch (row.kind) {
          case "blank":
            return <div key={i} {...rowProps} className="sheet-blank" />;
          case "section":
            return <div key={i} {...rowProps} className="sheet-section">[{row.label}]</div>;
          case "tabblock":
            return (
              <div key={i} {...rowProps} className={"sheet-row" + state}>
                <TabBlock
                  lines={row.lines}
                  chords={row.chords}
                  transpose={transpose}
                  onChordClick={onChordClick}
                  timing={tabTiming}
                  mode={tabMode}
                  practiceSpeed={practiceSpeed}
                  onModeChange={(m) => onTabModeChange?.(m)}
                  onPracticeSpeedChange={(s) => onPracticeSpeedChange?.(s)}
                  playback={tabPlayback?.row === i ? tabPlayback : null}
                  onPlay={() => onTabPlay?.(i)}
                  onStop={() => onTabStop?.()}
                  onDone={() => onTabDone?.()}
                />
              </div>
            );
          case "lyric":
            return (
              <div key={i} {...rowProps} className={"sheet-row" + state}>
                <LyricLine segments={row.segments} transpose={transpose} onChordClick={onChordClick} />
              </div>
            );
        }
      })}
    </div>
  );
});

function LyricLine({
  segments,
  transpose,
  onChordClick,
}: {
  segments: Segment[];
  transpose: number;
  onChordClick?: (chord: string) => void;
}) {
  const hasChords = segments.some((s) => s.chord);

  // Split segments into words, keeping each chord glued to the word under it.
  const pieces: Segment[] = segments.flatMap((seg) =>
    seg.text.split(/(?<=\s)(?=\S)/).map((text, i) => ({ chord: i === 0 ? seg.chord : undefined, text })),
  );
  // A line may only wrap after whitespace, so a chord that lands mid-word
  // ("lo[G]ve") never splits the word across two lines.
  const words: Segment[][] = [];
  for (const piece of pieces) {
    const prev = words[words.length - 1]?.at(-1);
    if (prev && !/\s$/.test(prev.text)) words[words.length - 1].push(piece);
    else words.push([piece]);
  }

  const chunks: ReactNode[] = words.map((word, wi) => (
    <span key={wi} className="word" data-w={word.some((p) => p.chord || p.text.trim()) || undefined}>
      {word.map((piece, pi) => {
        const shown = piece.chord ? transposeChord(piece.chord, transpose) : undefined;
        return (
          <span key={pi} className={"chunk" + (hasChords ? " with-chords" : "")}>
            {hasChords && (
              <span className="chord-slot">
                {shown && (
                  <button type="button" className="chord" onClick={() => onChordClick?.(shown)}>
                    {shown}
                  </button>
                )}
              </span>
            )}
            <LyricText text={piece.text || (shown ? " " : "")} />
          </span>
        );
      })}
    </span>
  ));

  return <div className={"sheet-line" + (hasChords ? " has-chords" : "")}>{chunks}</div>;
}

/** Lyric text with trailing spaces kept outside the highlightable part. */
function LyricText({ text }: { text: string }) {
  const body = text.trimEnd();
  return (
    <span className="lyric">
      {body && <span className="lyric-text">{body}</span>}
      {text.slice(body.length)}
    </span>
  );
}
