// Strumming patterns, and a small synthesized guitar that plays them.
import { getChordShapes } from "./chordShapes";

export type Stroke = "D" | "U" | "-" | "x";

export interface StrumPattern {
  strokes: Stroke[];
  /** Strokes per beat: 2 = eighth notes, 4 = sixteenths, 3 = triplets. */
  perBeat: number;
}

const STROKE_ALIASES: Record<string, Stroke> = {
  d: "D", "↓": "D", v: "D", u: "U", "↑": "U", "^": "U", "-": "-", ".": "-", _: "-", x: "x", X: "x", "*": "x",
};

/**
 * Parses one bar of strumming, e.g. "D - D U - U D U" or "D-DU-UDU".
 * Returns null when the text isn't a pattern.
 */
export function parseStrum(text: string | undefined, beatsPerBar: number): StrumPattern | null {
  if (!text?.trim()) return null;
  const strokes: Stroke[] = [];
  for (const ch of text.replace(/\s+/g, "")) {
    const s = STROKE_ALIASES[ch] ?? STROKE_ALIASES[ch.toLowerCase()];
    if (!s) return null;
    strokes.push(s);
  }
  if (!strokes.length) return null;
  return { strokes, perBeat: strokes.length / Math.max(1, beatsPerBar) };
}

/** Count labels shown under each stroke: "1 & 2 &", "1 e & a", "1 & a". */
export function strumCounts(p: StrumPattern): string[] {
  const sub =
    p.perBeat === 2 ? ["", "&"] : p.perBeat === 4 ? ["", "e", "&", "a"] : p.perBeat === 3 ? ["", "&", "a"] : null;
  return p.strokes.map((_, i) => {
    if (!sub) return String(i + 1);
    const beat = Math.floor(i / p.perBeat);
    const k = i % p.perBeat;
    return k === 0 ? String(beat + 1) : sub[k];
  });
}

// ---------- Synth ----------

// MIDI note numbers of the open strings, low E to high e.
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];
const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** The notes (in Hz) a chord's first voicing sounds, low to high. */
export function chordFrequencies(chord: string): number[] {
  const shape = getChordShapes(chord)[0];
  if (!shape) return [];
  return shape.frets.flatMap((f, s) => (f < 0 ? [] : [midiToHz(OPEN_STRINGS[s] + f)]));
}

/** A plucked string via Karplus–Strong: a burst of noise fed through a decaying delay line. */
function pluckBuffer(ctx: BaseAudioContext, hz: number, seconds = 1.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(rate * seconds), rate);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(rate / hz));
  for (let i = 0; i < period; i++) out[i] = Math.random() * 2 - 1;
  // Soften the initial burst so it sounds like a pick, not a buzz.
  for (let i = 1; i < period; i++) out[i] = 0.5 * (out[i] + out[i - 1]);
  for (let i = period; i < out.length; i++) {
    out[i] = 0.996 * 0.5 * (out[i - period] + out[i - period + 1]);
  }
  return buf;
}

export type StrokeListener = (index: number) => void;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

/** Loops a strumming pattern on a chord, scheduled on the Web Audio clock. */
export class StrumPlayer {
  bpm = 100;
  beatsPerBar = 4;
  click = true;
  chord = "C";
  pattern: StrumPattern | null = null;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private index = 0;
  private ringing: GainNode[] = [];
  private buffers = new Map<number, AudioBuffer>();
  private listeners = new Set<StrokeListener>();

  get running(): boolean {
    return this.timer !== null;
  }

  onStroke(fn: StrokeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.running || !this.pattern) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    this.index = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx?.currentTime ?? 0;
    this.ringing.forEach((g) => g.gain.setTargetAtTime(0, t, 0.05));
    this.ringing = [];
    this.listeners.forEach((fn) => fn(-1));
  }

  private schedule(): void {
    const ctx = this.ctx!;
    const p = this.pattern;
    if (!p) return;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const i = this.index % p.strokes.length;
      const onBeat = i % p.perBeat === 0;
      const beat = Math.floor(i / p.perBeat);
      if (this.click && Number.isInteger(p.perBeat) && onBeat) this.tick(this.nextTime, beat === 0);
      this.strike(p.strokes[i], this.nextTime, onBeat);
      const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
      window.setTimeout(() => this.running && this.listeners.forEach((fn) => fn(i)), delay);
      this.nextTime += 60 / this.bpm / p.perBeat;
      this.index++;
    }
  }

  private buffer(hz: number): AudioBuffer {
    const key = Math.round(hz * 10);
    let b = this.buffers.get(key);
    if (!b) {
      b = pluckBuffer(this.ctx!, hz);
      this.buffers.set(key, b);
    }
    return b;
  }

  /** Cut the strings that are still ringing, as a strumming hand does on the next stroke. */
  private damp(time: number) {
    this.ringing.forEach((g) => g.gain.setTargetAtTime(0, time, 0.015));
    this.ringing = [];
  }

  private strike(stroke: Stroke, time: number, onBeat: boolean) {
    const ctx = this.ctx!;
    if (stroke === "-") return;
    this.damp(time);
    if (stroke === "x") {
      this.chuck(time);
      return;
    }
    const notes = chordFrequencies(this.chord);
    // Up-strokes catch mostly the higher strings, lighter and quicker.
    const strings = stroke === "D" ? notes : notes.slice(-4).reverse();
    const spread = stroke === "D" ? 0.012 : 0.008;
    const level = (stroke === "D" ? 0.32 : 0.22) * (onBeat ? 1 : 0.8);
    strings.forEach((hz, k) => {
      const src = ctx.createBufferSource();
      src.buffer = this.buffer(hz);
      const g = ctx.createGain();
      g.gain.value = level;
      src.connect(g).connect(this.master!);
      src.start(time + k * spread);
      this.ringing.push(g);
    });
  }

  /** Muted strum: a short, dull burst of noise. */
  private chuck(time: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.6;
    src.connect(lp).connect(g).connect(this.master!);
    src.start(time);
  }

  private tick(time: number, strong: boolean) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = strong ? 1600 : 1000;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(strong ? 0.35 : 0.22, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(g).connect(this.master!);
    osc.start(time);
    osc.stop(time + 0.05);
  }
}

/** Shared so only one strum loop plays at a time. */
export const strumPlayer = new StrumPlayer();
