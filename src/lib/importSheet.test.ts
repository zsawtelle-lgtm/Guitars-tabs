import { describe, expect, it } from "vitest";
import { bookmarkletSource, cleanSheet, decodeImport, extractMeta, isLink, titleFromPage } from "./importSheet";

describe("cleanSheet", () => {
  it("strips Ultimate Guitar markup and tidies whitespace", () => {
    const raw = "\r\n\r\n[tab][ch]Am[/ch]   [ch]C[/ch]   \r\nThere is a house[/tab]\r\n\r\n\r\n\r\n[Verse 2]\r\n";
    expect(cleanSheet(raw)).toBe("Am   C\nThere is a house\n\n[Verse 2]");
  });
});

describe("extractMeta", () => {
  it("takes key, capo and tempo lines the sheet states, and removes them", () => {
    const { body, meta } = extractMeta("Key: am\nCapo: 2nd fret\nBPM: 96\n\n[Verse]\nG   C\nKey to my heart");
    expect(meta).toEqual({ key: "Am", capo: 2, tempo: 96 });
    expect(body).toBe("[Verse]\nG   C\nKey to my heart");
  });

  it("doesn't leave a double gap where metadata lines were", () => {
    expect(extractMeta("[Intro]\nAm C\n\nKey: Am\n\n[Verse]").body).toBe("[Intro]\nAm C\n\n[Verse]");
  });

  it("handles 'no capo' and ignores lines that aren't metadata", () => {
    expect(extractMeta("Capo: no capo\nTempo is everything").meta).toEqual({ capo: 0 });
    expect(extractMeta("Key: Hello").meta).toEqual({});
  });
});

describe("isLink / titleFromPage", () => {
  it("recognises a copied page link", () => {
    expect(isLink(" https://tabs.ultimate-guitar.com/tab/x/y-chords-1 ")).toBe(true);
    expect(isLink("Am C G\nhello")).toBe(false);
    expect(isLink("javascript:alert(1)")).toBe(false);
  });

  it("reads title and artist from chord page titles", () => {
    expect(titleFromPage("AMAZING GRACE CHORDS by Judy Collins @ Ultimate-Guitar.Com")).toEqual({
      title: "Amazing Grace", artist: "Judy Collins",
    });
    expect(titleFromPage("Wonderwall Tab by Oasis | Songsterr Tabs")).toEqual({ title: "Wonderwall", artist: "Oasis" });
    expect(titleFromPage("Some page")).toEqual({});
  });
});

describe("bookmarklet round trip", () => {
  it("encodes data the import screen can read back", () => {
    const src = bookmarkletSource("https://example.com/app/");
    expect(src.startsWith("javascript:")).toBe(true);
    // Run the bookmarklet against a fake page and capture the URL it opens.
    let opened = "";
    const code = decodeURIComponent(src.slice("javascript:".length));
    const fakeWindow = {
      getSelection: () => "Am  C\nThere is a house",
      open: (u: string) => { opened = u; },
    };
    new Function("window", "document", "location", "alert", code)(
      fakeWindow,
      { querySelectorAll: () => [], title: "HOUSE CHORDS by X" },
      { href: "https://tabs.ultimate-guitar.com/tab/x/house-chords-1" },
      () => {},
    );
    expect(opened.startsWith("https://example.com/app/#/import/")).toBe(true);
    const routeId = decodeURIComponent(opened.split("#/import/")[1]);
    expect(decodeImport(routeId)).toEqual({
      text: "Am  C\nThere is a house",
      url: "https://tabs.ultimate-guitar.com/tab/x/house-chords-1",
      title: "HOUSE CHORDS by X",
    });
  });

  it("rejects malformed payloads", () => {
    expect(decodeImport("not json")).toBeNull();
    expect(decodeImport(encodeURIComponent(JSON.stringify({ text: "x", url: "javascript:1" })))).toEqual({ text: "x", url: undefined, title: undefined });
  });
});
