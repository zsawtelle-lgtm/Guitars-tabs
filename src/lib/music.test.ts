import { describe, expect, it } from "vitest";
import { isChord, parseChord, transposeChord } from "./music";
import { getChordShapes } from "./chordShapes";

describe("parseChord", () => {
  it("parses roots, qualities and slash basses", () => {
    expect(parseChord("F#m7")).toEqual({ root: "F#", quality: "m7", bass: undefined });
    expect(parseChord("C/G")).toEqual({ root: "C", quality: "", bass: "G" });
    expect(parseChord("Bbmaj7")).toEqual({ root: "Bb", quality: "maj7", bass: undefined });
    expect(parseChord("Dsus4")?.quality).toBe("sus4");
    expect(parseChord("A7b9")?.quality).toBe("7b9");
  });

  it("rejects ordinary words", () => {
    for (const w of ["Bad", "Dad", "Every", "Go", "Come", "Am-I"]) expect(isChord(w)).toBe(false);
  });
});

describe("transposeChord", () => {
  it("shifts root and bass", () => {
    expect(transposeChord("Am", 2)).toBe("Bm");
    expect(transposeChord("C/G", 1)).toBe("C#/Ab");
    expect(transposeChord("G7", -2)).toBe("F7");
    expect(transposeChord("B", 1)).toBe("C");
  });

  it("is a no-op for whole octaves and non-chords", () => {
    expect(transposeChord("Em", 12)).toBe("Em");
    expect(transposeChord("N.C.", 3)).toBe("N.C.");
  });
});

describe("getChordShapes", () => {
  it("prefers hand-written open voicings", () => {
    expect(getChordShapes("G")[0].frets).toEqual([3, 2, 0, 0, 0, 3]);
    expect(getChordShapes("Am")[0].frets).toEqual([-1, 0, 2, 2, 1, 0]);
  });

  it("builds barre chords for any root", () => {
    const bm = getChordShapes("Bm")[0];
    expect(bm.frets).toEqual([-1, 2, 4, 4, 3, 2]);
    expect(bm.barre).toEqual({ fret: 2, from: 1, to: 5 });
    expect(getChordShapes("A#m")[0].frets).toEqual(getChordShapes("Bbm")[0].frets);
  });

  it("has a shape for every root in common qualities", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    for (const r of roots)
      for (const q of ["", "m", "7", "m7", "maj7", "sus4", "dim"])
        expect(getChordShapes(r + q).length, r + q).toBeGreaterThan(0);
  });
});
