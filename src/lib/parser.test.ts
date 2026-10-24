import { describe, expect, it } from "vitest";
import { chordsInSong, groupRows, mergeChordLine, parseInline, parseSong, tabMeasures, toInline } from "./parser";

describe("parseInline", () => {
  it("splits text at bracketed chords", () => {
    expect(parseInline("There [Am]is a [C]house")).toEqual([
      { chord: undefined, text: "There " },
      { chord: "Am", text: "is a " },
      { chord: "C", text: "house" },
    ]);
  });

  it("keeps non-chord brackets as text", () => {
    expect(parseInline("Repeat [x2]")).toEqual([{ chord: undefined, text: "Repeat [x2]" }]);
  });

  it("handles trailing chords with no lyric", () => {
    expect(parseInline("one [C] [D]")).toEqual([
      { chord: undefined, text: "one " },
      { chord: "C", text: " " },
      { chord: "D", text: "" },
    ]);
  });
});

describe("mergeChordLine", () => {
  it("places chords at their column in the lyric", () => {
    expect(mergeChordLine("Am    C", "There is a house")).toEqual([
      { chord: "Am", text: "There " },
      { chord: "C", text: "is a house" },
    ]);
  });

  it("keeps lyric text before the first chord", () => {
    expect(mergeChordLine("    G", "Oh, when the saints")).toEqual([
      { text: "Oh, " },
      { chord: "G", text: "when the saints" },
    ]);
  });
});

describe("parseSong", () => {
  const song = `[Verse]
G          D
Hello there friend
e|---0---|
[Chorus]
[C]La la [G]la

Em  C  |  x2`;

  it("recognises every line kind", () => {
    const lines = parseSong(song);
    expect(lines.map((l) => l.kind)).toEqual(["section", "lyric", "tab", "section", "lyric", "blank", "lyric"]);
    expect(chordsInSong(lines)).toEqual(["G", "D", "C", "Em"]);
  });

  it("round-trips chords-over-lyrics into inline notation", () => {
    expect(toInline("G          D\nHello there friend")).toBe("[G]Hello there[D] friend");
  });
});

describe("groupRows / tabMeasures", () => {
  it("groups consecutive tab lines into one block", () => {
    const rows = groupRows(parseSong("[Intro]\ne|--0--|\nB|--1--|\n\nLyric"));
    expect(rows.map((r) => r.kind)).toEqual(["section", "tabblock", "blank", "lyric"]);
    expect(rows[1]).toEqual({ kind: "tabblock", lines: ["e|--0--|", "B|--1--|"] });
  });

  it("attaches a chord line above a tab to the tab block", () => {
    const lines = parseSong("  Am   C\ne|0----|3----|\nB|-----|-----|");
    expect(groupRows(lines)).toEqual([
      {
        kind: "tabblock",
        chords: [{ col: 2, chord: "Am" }, { col: 7, chord: "C" }],
        lines: ["e|0----|3----|", "B|-----|-----|"],
      },
    ]);
    expect(chordsInSong(lines)).toEqual(["Am", "C"]);
  });

  it("finds measures between bar lines", () => {
    expect(tabMeasures(["e|---0---|-1-|", "B|-------|---|"])).toEqual([
      { start: 1, end: 9 },
      { start: 9, end: 13 },
    ]);
  });

  it("treats an unclosed last bar as running to the end of the line", () => {
    expect(tabMeasures(["e|--0--|--2--"])).toEqual([
      { start: 1, end: 7 },
      { start: 7, end: 13 },
    ]);
  });

  it("ignores double bar lines", () => {
    expect(tabMeasures(["e|--0--||--2--|"])).toEqual([
      { start: 1, end: 7 },
      { start: 8, end: 14 },
    ]);
  });
});
