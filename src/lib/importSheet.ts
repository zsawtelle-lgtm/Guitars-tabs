// Turning a chord sheet copied from a website into song text, and picking up the
// details the sheet itself states (key, capo, tempo). Nothing here is guessed:
// a field is only filled when the sheet spells it out.
import { isChord } from "./music";

export interface SheetMeta {
  key?: string;
  capo?: number;
  tempo?: number;
}

/** Normalizes copied text: line endings, odd spaces, Ultimate Guitar's [ch]/[tab] markup, extra blank lines. */
export function cleanSheet(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/​/g, "")
    .replace(/\[\/?tab\]/gi, "")
    .replace(/\[ch\](.*?)\[\/ch\]/gi, "$1")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

// Page furniture that chord sites put above the sheet ("Wonderwall Chords", "by Oasis",
// "Difficulty: novice", "Tuning: E A D G B E"…).
const HEADER_RE =
  /^\s*(?:.*\b(?:chords|tabs?|ukulele)\b(?:\s+by\s+.*)?|by\s+.+|(?:difficulty|tuning|author|strumming|version|ver|rating|transcribed by)\b.*)\s*$/i;
// The first line that's clearly part of the song: a [Section], a tab staff, or chords.
const SONG_START_RE = /^\s*(?:\[[^\]]+\]|[A-Ga-g][#b]?\s*\|)|^\s*[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|\d)*(?:\/[A-G][#b]?)?(?:\s+|$)/;

/** Drops site header lines that come before the song itself. */
export function trimHeader(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && !SONG_START_RE.test(lines[i]) && (!lines[i].trim() || HEADER_RE.test(lines[i]))) i++;
  return lines.slice(i).join("\n");
}

const META_RES: [keyof SheetMeta, RegExp][] = [
  ["key", /^\s*key\s*[:=-]?\s*([A-G][#b]?m?)\s*$/i],
  ["capo", /^\s*capo\s*[:=-]?\s*(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*fret)?\s*$/i],
  ["capo", /^\s*capo\s*[:=-]?\s*(no\s*capo|none)\s*$/i],
  ["tempo", /^\s*(?:tempo|bpm)\s*[:=-]?\s*(\d{2,3})\s*(?:bpm)?\s*$/i],
];

/** Pulls "Key: Am", "Capo: 2nd fret", "BPM: 96" lines out of a sheet. */
export function extractMeta(text: string): { body: string; meta: SheetMeta } {
  const meta: SheetMeta = {};
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    let matched = false;
    for (const [field, re] of META_RES) {
      const m = re.exec(line);
      if (!m) continue;
      const key = field === "key" ? m[1][0].toUpperCase() + m[1].slice(1) : "";
      if (field === "key" && isChord(key)) meta.key = key;
      else if (field === "capo") meta.capo = /\d/.test(m[1]) ? Number(m[1]) : 0;
      else if (field === "tempo" && Number(m[1]) >= 30 && Number(m[1]) <= 300) meta.tempo = Number(m[1]);
      else continue;
      matched = true;
      break;
    }
    if (!matched) kept.push(line);
  }
  return { body: kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, ""), meta };
}

/** "Key Am · Capo 2 · 96 BPM", for telling you what was picked up from a sheet. */
export function describeMeta(meta: SheetMeta): string {
  return [
    meta.key && `Key ${meta.key}`,
    meta.capo !== undefined && (meta.capo ? `Capo ${meta.capo}` : "No capo"),
    meta.tempo && `${meta.tempo} BPM`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The link in a short pasted snippet, e.g. a bare URL or what a phone's Share sheet
 * copies ("Check out this tab on Ultimate Guitar: https://…"). A long, multi-line
 * paste is treated as a chord sheet even if it happens to contain a link.
 */
export function findLink(text: string): string | null {
  const t = text.trim();
  if (!t || t.length > 500 || t.split("\n").length > 3) return null;
  const m = /https?:\/\/[^\s<>"']+/i.exec(t);
  if (!m) return null;
  const url = m[0].replace(/[).,;:!?]+$/, "");
  return isLink(url) ? url : null;
}

export function isLink(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Title and artist from a chord page's title, e.g. "AMAZING GRACE CHORDS by Judy Collins @ Ultimate-Guitar.Com". */
export function titleFromPage(pageTitle: string): { title?: string; artist?: string } {
  const m = /^(.*?)\s+(?:chords|tab|tabs|ukulele chords|bass tab)\s+by\s+(.*?)(?:\s+[@|–-]\s+.*)?$/i.exec(pageTitle.trim());
  if (!m) return {};
  const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s);
  return { title: titleCase(m[1].trim()), artist: m[2].trim() };
}

export interface ImportPayload {
  text: string;
  url?: string;
  title?: string;
}

/** Reads the data a "Send to Fretboard" bookmark put in the URL. */
export function decodeImport(encoded: string): ImportPayload | null {
  try {
    const data = JSON.parse(decodeURIComponent(encoded)) as Partial<ImportPayload>;
    if (typeof data.text !== "string" || !data.text.trim()) return null;
    return {
      text: data.text,
      url: typeof data.url === "string" && isLink(data.url) ? data.url : undefined,
      title: typeof data.title === "string" ? data.title : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Source of the "Send to Fretboard" bookmarklet. Run on a chord page, it takes the
 * selected text (or else the page's largest <pre>/<code> block, where chord sites
 * keep the sheet) plus the page link, and opens this app's import screen with them.
 */
export function bookmarkletSource(appUrl: string): string {
  const code = `(function(){var A=${JSON.stringify(appUrl)};var s=String(window.getSelection()).trim();
if(!s){var b='';document.querySelectorAll('pre,code').forEach(function(e){var t=e.innerText||'';if(t.length>b.length)b=t;});s=b.trim();}
if(!s){alert('Fretboard: select the chord sheet first, then click the bookmark again.');return;}
var d={text:s,url:location.href,title:document.title};
window.open(A+'#/import/'+encodeURIComponent(encodeURIComponent(JSON.stringify(d))),'_blank');})();`;
  return "javascript:" + encodeURIComponent(code.replace(/\n/g, ""));
}

export type Pasted = { kind: "link"; url: string } | { kind: "sheet"; body: string; meta: SheetMeta };

/** Works out what was pasted: a page link (to record as the source) or a chord sheet. */
export function readPasted(text: string): Pasted | null {
  if (!text.trim()) return null;
  const url = findLink(text);
  if (url) return { kind: "link", url };
  const { body, meta } = extractMeta(cleanSheet(text));
  const trimmed = trimHeader(body);
  return trimmed.trim() ? { kind: "sheet", body: trimmed, meta } : null;
}
