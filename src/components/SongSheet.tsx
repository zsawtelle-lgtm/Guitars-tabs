import { memo, type ReactNode } from "react";
import type { Line, Segment } from "../lib/parser";
import { transposeChord } from "../lib/music";

interface Props {
  lines: Line[];
  transpose: number;
  fontSize: number;
  onChordClick?: (chord: string) => void;
}

export const SongSheet = memo(function SongSheet({ lines, transpose, fontSize, onChordClick }: Props) {
  return (
    <div className="sheet" style={{ fontSize }}>
      {lines.map((line, i) => {
        switch (line.kind) {
          case "blank":
            return <div key={i} className="sheet-blank" />;
          case "section":
            return <div key={i} className="sheet-section">[{line.label}]</div>;
          case "tab":
            return <pre key={i} className="sheet-tab">{line.text}</pre>;
          case "lyric":
            return (
              <LyricLine key={i} segments={line.segments} transpose={transpose} onChordClick={onChordClick} />
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
    <span key={wi} className="word">
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
            <span className="lyric">{piece.text || (shown ? " " : "")}</span>
          </span>
        );
      })}
    </span>
  ));

  return <div className={"sheet-line" + (hasChords ? " has-chords" : "")}>{chunks}</div>;
}
