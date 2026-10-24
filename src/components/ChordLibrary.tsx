import { useState } from "react";
import { ChordWithVariations } from "./ChordViews";
import { ChordDiagram } from "./ChordDiagram";
import { getChordShapes } from "../lib/chordShapes";

const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const QUALITIES: { id: string; label: string }[] = [
  { id: "", label: "major" },
  { id: "m", label: "minor" },
  { id: "7", label: "7" },
  { id: "m7", label: "m7" },
  { id: "maj7", label: "maj7" },
  { id: "sus2", label: "sus2" },
  { id: "sus4", label: "sus4" },
  { id: "7sus4", label: "7sus4" },
  { id: "add9", label: "add9" },
  { id: "6", label: "6" },
  { id: "m6", label: "m6" },
  { id: "9", label: "9" },
  { id: "dim", label: "dim" },
  { id: "dim7", label: "dim7" },
  { id: "m7b5", label: "m7♭5" },
  { id: "aug", label: "aug" },
];

export function ChordLibrary() {
  const [root, setRoot] = useState("C");
  const [quality, setQuality] = useState("");
  return (
    <div className="page chord-library">
      <h1>Chords</h1>
      <div className="picker">
        {ROOTS.map((r) => (
          <button key={r} className={"pick" + (r === root ? " selected" : "")} onClick={() => setRoot(r)}>{r}</button>
        ))}
      </div>
      <div className="picker">
        {QUALITIES.map((q) => (
          <button key={q.id} className={"pick" + (q.id === quality ? " selected" : "")} onClick={() => setQuality(q.id)}>
            {q.label}
          </button>
        ))}
      </div>
      <div className="chord-library-main">
        <ChordWithVariations chord={root + quality} size={2} />
      </div>
      <h2>All {root} chords</h2>
      <div className="chord-grid">
        {QUALITIES.map((q) => (
          <button key={q.id} className="chord-strip-item" onClick={() => setQuality(q.id)}>
            <ChordDiagram name={root + q.id} shape={getChordShapes(root + q.id)[0]} size={0.9} />
          </button>
        ))}
      </div>
    </div>
  );
}
