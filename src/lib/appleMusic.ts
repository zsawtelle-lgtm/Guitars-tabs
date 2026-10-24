// Links to songs in Apple Music. These open the Music app on iPhone, iPad and Mac
// (playing from your own library/subscription) and the Apple Music website elsewhere.

const HOSTS = new Set(["music.apple.com", "geo.music.apple.com", "itunes.apple.com"]);

/** Returns a cleaned-up https link if `input` is an Apple Music link, otherwise null. */
export function parseAppleMusicUrl(input: string | undefined): string | null {
  const text = input?.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text.includes("://") ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname) || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  url.protocol = "https:";
  return url.toString();
}

export function appleMusicSearchUrl(title: string, artist: string): string {
  return `https://music.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`.trim())}`;
}
