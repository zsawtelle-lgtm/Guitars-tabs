// Sample-accurate metronome: a timer looks a little ahead and schedules clicks
// on the Web Audio clock, so tempo stays steady even if the UI thread stalls.

export type BeatListener = (beat: number, beatsPerBar: number) => void;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

export class Metronome {
  bpm = 100;
  beatsPerBar = 4;
  accent = true;
  volume = 0.8;

  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private listeners = new Set<BeatListener>();

  get running(): boolean {
    return this.timer !== null;
  }

  onBeat(fn: BeatListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    this.beat = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  toggle(): void {
    if (this.running) this.stop();
    else this.start();
  }

  private schedule(): void {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.click(this.nextTime, this.beat);
      const beat = this.beat;
      const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
      window.setTimeout(() => this.listeners.forEach((fn) => fn(beat, this.beatsPerBar)), delay);
      this.nextTime += 60 / this.bpm;
      this.beat = (this.beat + 1) % this.beatsPerBar;
    }
  }

  private click(time: number, beat: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const strong = this.accent && beat === 0;
    osc.frequency.value = strong ? 1600 : 1000;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(this.volume * (strong ? 1 : 0.6), time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}

/** Shared instance so the metronome keeps running while you move between screens. */
export const metronome = new Metronome();

/** Average the gaps between recent taps into a BPM, or null if there aren't enough taps. */
export function tapTempo(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const gaps = taps.slice(1).map((t, i) => t - taps[i]);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.round(Math.min(300, Math.max(30, 60000 / avg)));
}
