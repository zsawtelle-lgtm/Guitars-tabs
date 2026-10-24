// Turns song text into renderable lines.
//
// Two chord notations are supported, and can be mixed freely:
//   Inline (ChordPro):   [Am]There is a [C]house in [D]New Orleans
//   Chords over lyrics:  Am        C         D
//                        There is a house in New Orleans
// Plus [Verse] / [Chorus] section headers and tab staff lines (e|---0---|).
import { isChord } from "./music";

export interface Segment {
  chord?: string;
  text: string;
}

export type Line =
  | { kind: "lyric"; segments: Segment[] }
  | { kind: "section"; label: string }
  | { kind: "tab"; text: string }
  /** A chord-only line sitting directly above a tab, naming the chords played in it. */
  | { kind: "tabchords"; text: string }
  | { kind: "blank" };

const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/;
const DIRECTIVE_RE = /^\s*\{\s*(?:c|comment|soc|start_of_chorus)?\s*:?\s*([^}]*)\}\s*$/i;
const TAB_RE = /^\s*[A-Ga-g][#b]?\s*\|.*-/;
const INLINE_CHORD_RE = /\[([^\]]+)\]/g;
// Tokens that may sit on a chord line without making it a lyric line.
const CHORD_LINE_FILLER = /^(\||\|\||-+|\/|x\d+|\(x?\d+x?\)|N\.?C\.?|%)$/i;

function isChordOnlyLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let chords = 0;
  for (const t of tokens) {
    if (isChord(t)) chords++;
    else if (!CHORD_LINE_FILLER.test(t)) return false;
  }
  return chords > 0;
}

function chordColumns(line: string): { col: number; chord: string }[] {
  const out: { col: number; chord: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (isChord(m[0])) out.push({ col: m.index, chord: m[0] });
  }
  return out;
}

/** Combine a chord line with the lyric line underneath it. */
export function mergeChordLine(chordLine: string, lyric: string): Segment[] {
  const cols = chordColumns(chordLine);
  const segments: Segment[] = [];
  if (!cols.length || cols[0].col > 0) {
    segments.push({ text: lyric.slice(0, cols.length ? cols[0].col : undefined) });
  }
  cols.forEach(({ col, chord }, i) => {
    const end = i + 1 < cols.length ? cols[i + 1].col : undefined;
    segments.push({ chord, text: lyric.slice(col, end) });
  });
  return segments.filter((s) => s.chord || s.text);
}

function chordLineSegments(line: string): Segment[] {
  const cols = chordColumns(line);
  return cols.map(({ col, chord }, i) => {
    const next = i + 1 < cols.length ? cols[i + 1].col : col + chord.length + 1;
    return { chord, text: " ".repeat(Math.max(1, next - col)) };
  });
}

export function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let pending: string | undefined;
  for (const m of line.matchAll(INLINE_CHORD_RE)) {
    const inner = m[1].trim();
    if (!isChord(inner)) continue; // e.g. "[x2]" stays as plain text
    const text = line.slice(last, m.index);
    if (text || pending) segments.push({ chord: pending, text });
    pending = inner;
    last = m.index! + m[0].length;
  }
  const rest = line.slice(last);
  if (rest || pending) segments.push({ chord: pending, text: rest });
  return segments;
}

function isPlainLyric(line: string): boolean {
  return (
    line.trim() !== "" &&
    !SECTION_RE.test(line) &&
    !TAB_RE.test(line) &&
    !DIRECTIVE_RE.test(line) &&
    !isChordOnlyLine(line) &&
    !/\[[^\]]+\]/.test(line)
  );
}

export function parseSong(body: string): Line[] {
  const src = body.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const lines: Line[] = [];
  for (let i = 0; i < src.length; i++) {
    const raw = src[i].replace(/\s+$/, "");
    if (!raw.trim()) {
      lines.push({ kind: "blank" });
      continue;
    }
    const section = SECTION_RE.exec(raw);
    if (section && !isChord(section[1].trim())) {
      lines.push({ kind: "section", label: section[1].trim() });
      continue;
    }
    const directive = DIRECTIVE_RE.exec(raw);
    if (directive) {
      if (directive[1].trim()) lines.push({ kind: "section", label: directive[1].trim() });
      continue;
    }
    if (TAB_RE.test(raw)) {
      lines.push({ kind: "tab", text: raw });
      continue;
    }
    if (isChordOnlyLine(raw)) {
      const next = src[i + 1]?.replace(/\s+$/, "");
      if (next !== undefined && TAB_RE.test(next)) {
        lines.push({ kind: "tabchords", text: raw });
      } else if (next !== undefined && isPlainLyric(next)) {
        lines.push({ kind: "lyric", segments: mergeChordLine(raw, next) });
        i++;
      } else {
        lines.push({ kind: "lyric", segments: chordLineSegments(raw) });
      }
      continue;
    }
    lines.push({ kind: "lyric", segments: parseInline(raw) });
  }
  // Trim leading/trailing blank lines.
  while (lines[0]?.kind === "blank") lines.shift();
  while (lines[lines.length - 1]?.kind === "blank") lines.pop();
  return lines;
}

/** Unique chords in order of first appearance. */
export function chordsInSong(lines: Line[]): string[] {
  const seen = new Set<string>();
  for (const l of lines) {
    if (l.kind === "lyric") for (const s of l.segments) if (s.chord) seen.add(s.chord);
    if (l.kind === "tabchords") for (const { chord } of chordColumns(l.text)) seen.add(chord);
  }
  return [...seen];
}

/** Convert any song text to inline [Chord] notation (used when importing pasted text). */
export function toInline(body: string): string {
  return parseSong(body)
    .map((l) => {
      switch (l.kind) {
        case "blank":
          return "";
        case "section":
          return `[${l.label}]`;
        case "tab":
        case "tabchords":
          return l.text;
        case "lyric":
          return l.segments.map((s) => (s.chord ? `[${s.chord}]` : "") + s.text).join("").trimEnd();
      }
    })
    .join("\n");
}

/** A renderable row: consecutive tab lines are grouped into one block. */
export type Row =
  | Exclude<Line, { kind: "tab" | "tabchords" }>
  | { kind: "tabblock"; lines: string[]; chords?: { col: number; chord: string }[] };

export function groupRows(lines: Line[]): Row[] {
  const rows: Row[] = [];
  for (const line of lines) {
    const prev = rows[rows.length - 1];
    if (line.kind === "tabchords") rows.push({ kind: "tabblock", lines: [], chords: chordColumns(line.text) });
    else if (line.kind !== "tab") rows.push(line);
    else if (prev?.kind === "tabblock") prev.lines.push(line.text);
    else rows.push({ kind: "tabblock", lines: [line.text] });
  }
  return rows;
}

/** Rows that represent something to play (used for highlighting progress). */
export function isContentRow(row: Row): boolean {
  return row.kind === "lyric" || row.kind === "tabblock";
}

export interface Measure {
  /** Column of the bar line that opens the measure. */
  start: number;
  /** Column of the bar line that closes it (or the end of the line). */
  end: number;
}

/**
 * Measures in a tab block, from the bar lines (|) of its longest line.
 * Each measure is played over one bar of the song's time signature.
 */
export function tabMeasures(lines: string[]): Measure[] {
  const line = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  const bars: number[] = [];
  for (let i = 0; i < line.length; i++) if (line[i] === "|") bars.push(i);
  if (!bars.length) return [];
  const content = line.replace(/\s+$/, "").length;
  if (content - 1 > bars[bars.length - 1]) bars.push(content);
  const measures: Measure[] = [];
  for (let i = 0; i + 1 < bars.length; i++) {
    // Skip the empty gap inside a double bar line (||).
    if (bars[i + 1] - bars[i] > 1) measures.push({ start: bars[i], end: bars[i + 1] });
  }
  return measures;
}
