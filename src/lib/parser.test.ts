import { describe, expect, it } from "vitest";
import { chordsInSong, mergeChordLine, parseInline, parseSong, toInline } from "./parser";

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
