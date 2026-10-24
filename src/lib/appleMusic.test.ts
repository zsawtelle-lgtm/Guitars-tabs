import { describe, expect, it } from "vitest";
import { parseAppleMusicUrl } from "./appleMusic";

describe("parseAppleMusicUrl", () => {
  it("accepts Apple Music share links", () => {
    const link = "https://music.apple.com/us/album/amazing-grace/1440833098?i=1440833102";
    expect(parseAppleMusicUrl(link)).toBe(link);
    expect(parseAppleMusicUrl("  music.apple.com/us/song/x/123 ")).toBe("https://music.apple.com/us/song/x/123");
    expect(parseAppleMusicUrl("https://geo.music.apple.com/us/album/x/1")).toBe("https://geo.music.apple.com/us/album/x/1");
  });

  it("rejects other links", () => {
    expect(parseAppleMusicUrl("")).toBeNull();
    expect(parseAppleMusicUrl("https://open.spotify.com/track/abc")).toBeNull();
    expect(parseAppleMusicUrl("javascript:alert(1)")).toBeNull();
    expect(parseAppleMusicUrl("https://music.apple.com.evil.example/x")).toBeNull();
  });
});
