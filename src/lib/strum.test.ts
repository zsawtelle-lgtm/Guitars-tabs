import { describe, expect, it } from "vitest";
import { chordFrequencies, parseStrum, strumCounts } from "./strum";

describe("parseStrum", () => {
  it("reads spaced and compact notation", () => {
    expect(parseStrum("D - D U - U D U", 4)).toEqual({ strokes: ["D", "-", "D", "U", "-", "U", "D", "U"], perBeat: 2 });
    expect(parseStrum("d-du-udu", 4)?.strokes).toEqual(["D", "-", "D", "U", "-", "U", "D", "U"]);
    expect(parseStrum("↓ ↑ x ↑", 2)?.strokes).toEqual(["D", "U", "x", "U"]);
  });

  it("rejects text that isn't a pattern", () => {
    expect(parseStrum("", 4)).toBeNull();
    expect(parseStrum("Down up", 4)).toBeNull();
  });
});

describe("strumCounts", () => {
  it("labels eighths, sixteenths and triplets", () => {
    expect(strumCounts(parseStrum("DUDUDUDU", 4)!)).toEqual(["1", "&", "2", "&", "3", "&", "4", "&"]);
    expect(strumCounts(parseStrum("DUDU", 1)!)).toEqual(["1", "e", "&", "a"]);
    expect(strumCounts(parseStrum("D-DU-U", 2)!)).toEqual(["1", "&", "a", "2", "&", "a"]);
  });
});

describe("chordFrequencies", () => {
  it("returns the sounding notes of the chord voicing", () => {
    // Open E minor: E2 B2 E3 G3 B3 E4
    expect(chordFrequencies("Em").map((f) => Math.round(f))).toEqual([82, 123, 165, 196, 247, 330]);
    expect(chordFrequencies("Am")).toHaveLength(5);
  });
});
