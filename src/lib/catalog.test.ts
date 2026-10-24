import { describe, expect, it } from "vitest";
import { findExisting, normalizeName, toCatalogSong } from "./catalog";

const track = {
  wrapperType: "track",
  kind: "song",
  trackId: 1440833102,
  trackName: "Amazing Grace",
  artistName: "Judy Collins",
  collectionName: "Whales & Nightingales",
  trackTimeMillis: 245_400,
  releaseDate: "1970-11-01T08:00:00Z",
  primaryGenreName: "Folk",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/ab/cd/100x100bb.jpg",
  trackViewUrl: "https://music.apple.com/us/album/amazing-grace/1440833098?i=1440833102&uo=4",
};

describe("toCatalogSong", () => {
  it("maps the catalog fields and cleans up the link and artwork", () => {
    expect(toCatalogSong(track)).toEqual({
      appleId: 1440833102,
      title: "Amazing Grace",
      artist: "Judy Collins",
      album: "Whales & Nightingales",
      duration: 245,
      year: 1970,
      genre: "Folk",
      artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music/ab/cd/300x300bb.jpg",
      url: "https://music.apple.com/us/album/amazing-grace/1440833098?i=1440833102",
    });
  });
});

describe("normalizeName / findExisting", () => {
  it("ignores case, punctuation and remaster tags", () => {
    expect(normalizeName("Here Comes the Sun (Remastered 2009)")).toBe("here comes the sun");
    expect(normalizeName("Wonderwall - Remastered")).toBe("wonderwall");
    expect(normalizeName("Simon & Garfunkel")).toBe("simon and garfunkel");
  });

  it("matches by Apple ID first, then by name", () => {
    const songs = [
      { id: "a", title: "amazing grace", artist: "Judy Collins!" },
      { id: "b", title: "Other", artist: "X", appleId: 1440833102 },
    ];
    expect(findExisting(songs, toCatalogSong(track))?.id).toBe("b");
    expect(findExisting(songs.slice(0, 1), toCatalogSong(track))?.id).toBe("a");
    expect(findExisting([{ title: "Amazing Grace", artist: "John Newton" }], toCatalogSong(track))).toBeUndefined();
  });
});
