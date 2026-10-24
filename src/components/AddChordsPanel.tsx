import { useState } from "react";
import { chordSearchLinks } from "../lib/catalog";
import { describeMeta, readPasted } from "../lib/importSheet";
import { saveSong, setImportTarget, type Song } from "../lib/storage";
import { isTouch, PasteBox } from "./PasteBox";

/**
 * Shown on a song with no chords yet. Chord sites don't let other apps read their pages,
 * so the sheet comes over by copy and paste: open it, copy it, paste it here.
 */
export function AddChordsPanel({ song }: { song: Song }) {
  const [message, setMessage] = useState<string | null>(null);
  let host: string | null = null;
  try {
    host = song.chordSource ? new URL(song.chordSource).hostname.replace(/^www\./, "") : null;
  } catch {
    host = null;
  }

  const onText = (text: string) => {
    const pasted = readPasted(text);
    if (!pasted) {
      setMessage("That paste was empty. Copy the chord sheet on the chord site and try again.");
      return;
    }
    if (pasted.kind === "link") {
      saveSong({ ...song, chordSource: pasted.url });
      setMessage("Saved the link as the chord source. Now open it, copy the chord sheet itself, and paste it here.");
      return;
    }
    const { body, meta } = pasted;
    // Saving re-renders the page with the chords in place of this panel.
    saveSong({ ...song, body, key: meta.key ?? song.key, capo: meta.capo ?? song.capo, tempo: meta.tempo ?? song.tempo });
    const found = describeMeta(meta);
    if (found) setMessage(`From the sheet: ${found}.`);
  };

  return (
    <div className="chord-source-panel no-chords">
      <div>
        <b>No chords yet</b>
        {host ? (
          <>
            <p className="muted">
              Chord sites don't let other apps load their pages, so bring the sheet over by copying it.
            </p>
            <ol className="add-chords-steps">
              <li>
                <a className="btn primary" href={song.chordSource} target="_blank" rel="noreferrer"
                  onClick={() => setImportTarget(song.id)}>
                  Open the chord sheet on {host} ↗
                </a>
              </li>
              <li>Select the whole sheet there and tap <b>Copy</b>.</li>
              <li>Come back and {isTouch ? <>tap and hold the box below, then tap <b>Paste</b></> : <>click the box below and press <b>⌘V</b></>}.</li>
            </ol>
          </>
        ) : (
          <>
            <p className="muted">
              Find a published chord sheet for this song, copy it, and paste it below. Paste the page's link too, so you
              know where the chords came from.
            </p>
            <div className="source-links">
              {chordSearchLinks(song.title, song.artist).map((l) => (
                <a key={l.label} className="btn" href={l.url} target="_blank" rel="noreferrer"
                  onClick={() => setImportTarget(song.id)}>{l.label} ↗</a>
              ))}
            </div>
          </>
        )}
        <PasteBox onText={onText} label={isTouch ? "Tap and hold here, then tap Paste" : "Click here and press ⌘V"} />
        {message && <p className="paste-hint">{message}</p>}
        <p className="muted paste-hint">
          Or type it in with <a href={`#/edit/${encodeURIComponent(song.id)}`}>Edit</a>.
        </p>
      </div>
    </div>
  );
}
