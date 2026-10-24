// Note names, chord parsing and transposition.

const SHARP_TO_INDEX: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, "B#": 0,
};

// The spelling guitarists use most often for each pitch class.
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export interface ParsedChord {
  root: string;
  quality: string;
  bass?: string;
}

// Root, optional accidental, a quality made of chord-ish characters, and optional slash bass.
const CHORD_RE =
  /^([A-G](?:#|b)?)((?:maj|min|m|M|dim|aug|sus|add|°|ø|\+|-|\d|\(|\)|b|#|\/(?![A-G]))*)(?:\/([A-G](?:#|b)?))?$/;

export function parseChord(token: string): ParsedChord | null {
  const m = CHORD_RE.exec(token.trim());
  if (!m) return null;
  return { root: m[1], quality: m[2] ?? "", bass: m[3] };
}

export function isChord(token: string): boolean {
  return parseChord(token) !== null;
}

export function noteIndex(note: string): number {
  const i = SHARP_TO_INDEX[note];
  if (i === undefined) throw new Error(`Unknown note: ${note}`);
  return i;
}

export function transposeNote(note: string, semitones: number): string {
  const i = noteIndex(note);
  return NOTE_NAMES[(((i + semitones) % 12) + 12) % 12];
}

export function transposeChord(chord: string, semitones: number): string {
  if (semitones % 12 === 0) return chord;
  const p = parseChord(chord);
  if (!p) return chord;
  const root = transposeNote(p.root, semitones);
  const bass = p.bass ? "/" + transposeNote(p.bass, semitones) : "";
  return root + p.quality + bass;
}

/** Canonical spelling, used to look up chord shapes (e.g. "A#m" -> "Bbm"). */
export function normalizeChord(chord: string): string {
  const p = parseChord(chord);
  if (!p) return chord;
  return transposeNote(p.root, 0) + p.quality + (p.bass ? "/" + transposeNote(p.bass, 0) : "");
}
