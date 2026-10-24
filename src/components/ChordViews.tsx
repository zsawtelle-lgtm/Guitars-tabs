import { useEffect, useState } from "react";
import { ChordDiagram } from "./ChordDiagram";
import { getChordShapes } from "../lib/chordShapes";

export function ChordWithVariations({ chord, size = 1.4 }: { chord: string; size?: number }) {
  const shapes = getChordShapes(chord);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [chord]);
  const idx = Math.min(i, Math.max(0, shapes.length - 1));
  return (
    <div className="chord-variations">
      <ChordDiagram name={chord} shape={shapes[idx]} size={size} />
      {shapes.length > 1 && (
        <div className="variation-nav">
          <button className="icon-btn" onClick={() => setI((idx - 1 + shapes.length) % shapes.length)}
            aria-label="Previous voicing">‹</button>
          <span>{idx + 1} / {shapes.length}</span>
          <button className="icon-btn" onClick={() => setI((idx + 1) % shapes.length)}
            aria-label="Next voicing">›</button>
        </div>
      )}
    </div>
  );
}

export function ChordPopover({ chord, onClose }: { chord: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal chord-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={chord}>
        <button className="modal-close icon-btn" onClick={onClose} aria-label="Close">×</button>
        <ChordWithVariations chord={chord} size={1.8} />
      </div>
    </div>
  );
}

export function ChordStrip({ chords, onSelect }: { chords: string[]; onSelect: (c: string) => void }) {
  if (!chords.length) return null;
  return (
    <div className="chord-strip">
      {chords.map((c) => (
        <button key={c} className="chord-strip-item" onClick={() => onSelect(c)}>
          <ChordDiagram name={c} shape={getChordShapes(c)[0]} size={0.85} />
        </button>
      ))}
    </div>
  );
}
