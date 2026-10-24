import { useState } from "react";
import { appleMusicSearchUrl, parseAppleMusicUrl } from "../lib/appleMusic";
import type { SongPrefs } from "../lib/storage";
import { MacShortcutHelp } from "./MacShortcutHelp";

interface Props {
  title: string;
  artist: string;
  prefs: SongPrefs;
  setPrefs: (patch: Partial<SongPrefs>) => void;
}

export function AppleMusicRow({ title, artist, prefs, setPrefs }: Props) {
  const link = parseAppleMusicUrl(prefs.appleMusicUrl);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  if (link && !editing) {
    return (
      <section className="apple-row">
        <span className="apple-mark" aria-hidden>♫</span>
        <span className="strum-title">Apple Music</span>
        <a className="btn primary" href={link} target="_blank" rel="noreferrer">Open in Apple Music ↗</a>
        <span className="muted apple-hint">Start it there, then come back and press ▶ to autoscroll.</span>
        <button type="button" className="btn apple-small" onClick={() => setHelp(true)}
          title="Start Music and the autoscroll together with one keyboard shortcut">
          ⌨ One-key start (Mac)
        </button>
        <button type="button" className="btn apple-small" onClick={() => {
          setDraft(prefs.appleMusicUrl ?? "");
          setEditing(true);
        }}>Change</button>
        <button type="button" className="btn apple-small" onClick={() => setPrefs({ appleMusicUrl: undefined })}>
          Remove
        </button>
        {help && <MacShortcutHelp onClose={() => setHelp(false)} />}
      </section>
    );
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const url = parseAppleMusicUrl(draft);
    if (!url) {
      setError("That isn't an Apple Music link. In Music, use Share → Copy Link on the song.");
      return;
    }
    setError(null);
    setPrefs({ appleMusicUrl: url });
    setEditing(false);
  };

  return (
    <section className="apple-row editing">
      <form className="video-add" onSubmit={save}>
        <span className="apple-mark" aria-hidden>♫</span>
        <span className="strum-title">Apple Music</span>
        <input className="search" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste an Apple Music song link…" aria-label="Apple Music link" />
        <button className="btn primary" type="submit">Save</button>
        {editing ? (
          <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
        ) : (
          <a className="btn" href={appleMusicSearchUrl(title, artist)} target="_blank" rel="noreferrer">
            Search Apple Music ↗
          </a>
        )}
      </form>
      {error && <p className="video-error">{error}</p>}
    </section>
  );
}
