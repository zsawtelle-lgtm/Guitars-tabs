import { describe, expect, it } from "vitest";
import { parseYouTubeId } from "./youtube";

describe("parseYouTubeId", () => {
  it("handles the common link formats", () => {
    const id = "dQw4w9WgXcQ";
    for (const link of [
      id,
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=42s&list=PL123`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://music.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
    ]) {
      expect(parseYouTubeId(link), link).toBe(id);
    }
  });

  it("rejects anything else", () => {
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId("https://vimeo.com/12345")).toBeNull();
    expect(parseYouTubeId("not a link")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});
