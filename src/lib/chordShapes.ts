// Guitar chord voicings. Frets are listed low E -> high e; -1 = muted, 0 = open.
import { noteIndex, parseChord, transposeNote } from "./music";

export interface ChordShape {
  frets: number[];
  fingers?: number[];
  /** Fret number shown next to the first row when the shape is up the neck. */
  baseFret: number;
  barre?: { fret: number; from: number; to: number };
}

type Raw = [frets: number[], fingers?: number[]];

// Hand-picked open voicings for the chords beginners reach for first.
const OPEN: Record<string, Raw[]> = {
  C: [[[-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]]],
  C7: [[[-1, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0]]],
  Cmaj7: [[[-1, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0]]],
  Cadd9: [[[-1, 3, 2, 0, 3, 0], [0, 2, 1, 0, 3, 0]]],
  D: [[[-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]]],
  Dm: [[[-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]]],
  D7: [[[-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]]],
  Dm7: [[[-1, -1, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1]]],
  Dmaj7: [[[-1, -1, 0, 2, 2, 2], [0, 0, 0, 1, 1, 1]]],
  Dsus2: [[[-1, -1, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0]]],
  Dsus4: [[[-1, -1, 0, 2, 3, 3], [0, 0, 0, 1, 2, 3]]],
  E: [[[0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]]],
  Em: [[[0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]]],
  E7: [[[0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]]],
  Em7: [[[0, 2, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0]]],
  Esus4: [[[0, 2, 2, 2, 0, 0], [0, 2, 3, 4, 0, 0]]],
  F: [[[1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1]]],
  Fmaj7: [[[-1, -1, 3, 2, 1, 0], [0, 0, 3, 2, 1, 0]]],
  G: [[[3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]]],
  G7: [[[3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]]],
  Gmaj7: [[[3, 2, 0, 0, 0, 2], [3, 2, 0, 0, 0, 1]]],
  A: [[[-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]]],
  Am: [[[-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]]],
  A7: [[[-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]]],
  Am7: [[[-1, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0]]],
  Amaj7: [[[-1, 0, 2, 1, 2, 0], [0, 0, 2, 1, 3, 0]]],
  Asus2: [[[-1, 0, 2, 2, 0, 0], [0, 0, 1, 2, 0, 0]]],
  Asus4: [[[-1, 0, 2, 2, 3, 0], [0, 0, 1, 2, 3, 0]]],
  B7: [[[-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4]]],
};

// Movable barre templates relative to the root fret (offsets; -1 muted).
// E-shape has its root on the low E string, A-shape on the A string.
const E_SHAPES: Record<string, number[]> = {
  "": [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, -1, 1, 1, 0, -1],
  sus4: [0, 2, 2, 2, 0, 0],
  "6": [0, -1, 1, 1, 2, -1],
  m6: [0, -1, -1, 0, 2, 0],
  "9": [0, 2, 0, 1, 0, 2],
  dim: [0, 1, 2, 0, -1, -1],
  aug: [0, -1, 2, 1, 1, 0],
  "7sus4": [0, 2, 0, 2, 0, 0],
};
const A_SHAPES: Record<string, number[]> = {
  "": [-1, 0, 2, 2, 2, 0],
  m: [-1, 0, 2, 2, 1, 0],
  "7": [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  sus2: [-1, 0, 2, 2, 0, 0],
  sus4: [-1, 0, 2, 2, 3, 0],
  add9: [-1, 0, 2, 4, 2, 0],
  "6": [-1, 0, 2, 2, 2, 2],
  m6: [-1, 0, 2, -1, 1, 2],
  "9": [-1, 0, -1, 0, 0, 0],
  dim: [-1, 0, 1, 2, 1, -1],
  dim7: [-1, 0, 1, 2, 1, 2],
  m7b5: [-1, 0, 1, 0, 1, -1],
  aug: [-1, 0, 3, 2, 2, 1],
  "7sus4": [-1, 0, 2, 0, 3, 0],
};

// Collapse common spellings of the same quality.
const QUALITY_ALIASES: Record<string, string> = {
  min: "m", "-": "m", M: "", maj: "", M7: "maj7", "Δ": "maj7", "Δ7": "maj7",
  sus: "sus4", "°": "dim", o: "dim", "°7": "dim7", ø: "m7b5", "ø7": "m7b5",
  "+": "aug", "2": "sus2", add2: "add9", m9: "m7", maj9: "maj7", "7b9": "7",
  "7#9": "7", "11": "7sus4", "13": "7", "6/9": "6", "69": "6", "5": "",
};

function fromRaw([frets, fingers]: Raw): ChordShape {
  const played = frets.filter((f) => f > 0);
  const min = played.length ? Math.min(...played) : 1;
  const max = played.length ? Math.max(...played) : 1;
  return { frets, fingers, baseFret: max > 4 ? min : 1 };
}

function fromTemplate(template: number[], rootFret: number, rootString: number): ChordShape {
  const frets = template.map((o) => (o < 0 ? -1 : o + rootFret));
  // Barre across the strings that share the root fret, starting from the root string.
  const barreStrings = frets
    .map((f, i) => (f === rootFret && i >= rootString ? i : -1))
    .filter((i) => i >= 0);
  const barre =
    rootFret > 0 && barreStrings.length > 1
      ? { fret: rootFret, from: barreStrings[0], to: barreStrings[barreStrings.length - 1] }
      : undefined;
  const played = frets.filter((f) => f > 0);
  const max = played.length ? Math.max(...played) : 1;
  return { frets, baseFret: max > 4 ? rootFret : 1, barre };
}

function canonicalQuality(q: string): string {
  return QUALITY_ALIASES[q] ?? q;
}

/** All known voicings for a chord, easiest first. Empty when the chord isn't recognised. */
export function getChordShapes(chord: string): ChordShape[] {
  const p = parseChord(chord);
  if (!p) return [];
  const root = transposeNote(p.root, 0);
  const quality = canonicalQuality(p.quality);
  const shapes: ChordShape[] = [];

  const open = OPEN[root + quality];
  if (open) shapes.push(...open.map(fromRaw));

  // E string: E=0, A string: A=0 — fret where this root sits on each.
  const eFret = (noteIndex(root) - noteIndex("E") + 12) % 12;
  const aFret = (noteIndex(root) - noteIndex("A") + 12) % 12;
  const candidates: ChordShape[] = [];
  if (E_SHAPES[quality]) candidates.push(fromTemplate(E_SHAPES[quality], eFret, 0));
  if (A_SHAPES[quality]) candidates.push(fromTemplate(A_SHAPES[quality], aFret, 1));
  candidates.sort((a, b) => a.baseFret - b.baseFret);
  for (const c of candidates) {
    if (!shapes.some((s) => s.frets.join() === c.frets.join())) shapes.push(c);
  }
  return shapes;
}
