import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteSong, newSongId, saveSong, setImportTarget, type Song } from "../lib/storage";
import { BUILT_IN_SONGS } from "../data/songs";
import { groupRows, parseSong, toInline } from "../lib/parser";
import { SongSheet } from "./SongSheet";
import { chordSearchLinks } from "../lib/catalog";
import { bookmarkletSource, describeMeta, readPasted } from "../lib/importSheet";
import { isTouch, PasteBox } from "./PasteBox";

const EMPTY: Song = { id: "", title: "", artist: "", body: "" };

const PLACEHOLDER = `[Verse 1]
[Am]Type chords in brackets [C]right before the syllable
[G]Or paste chords on their own line above the lyrics:

Am        C          G
Both styles work and can be mixed

[Chorus]
e|---0---1---3---|  <- tab lines are kept as-is`;

export function Editor({ song }: { song?: Song }) {
  const [draft, setDraft] = useState<Song>(song ?? EMPTY);
  const [preview, setPreview] = useState(false);
  const rows = useMemo(() => groupRows(parseSong(draft.body)), [draft.body]);
  const original = song && BUILT_IN_SONGS.find((s) => s.id === song.id);
  const isUserCopy = song && !song.builtIn;

  const set = <K extends keyof Song>(key: K, value: Song[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const [notice, setNotice] = useState<string | null>(null);

  // Whatever you copied on the chord site: a page link becomes the chord source, and a
  // chord sheet becomes the song text (with any key/capo/tempo the sheet lists).
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const applyPasted = useCallback((text: string) => {
    const pasted = readPasted(text);
    if (!pasted) return;
    if (pasted.kind === "link") {
      const url = pasted.url;
      setDraft((d) => ({ ...d, chordSource: url }));
      setNotice(
        `Saved ${new URL(url).hostname.replace(/^www\./, "")} as the chord source.` +
          (draftRef.current.body.trim() ? "" : " Now copy the chord sheet itself and paste it too."),
      );
      return;
    }
    const { body, meta } = pasted;
    const hadSource = !!draftRef.current.chordSource;
    setDraft((d) => ({ ...d, body, key: meta.key ?? d.key, capo: meta.capo ?? d.capo, tempo: meta.tempo ?? d.tempo }));
    setPreview(true);
    const found = describeMeta(meta);
    const lines = body.split("\n").length;
    setNotice(
      `Pasted ${lines} line${lines === 1 ? "" : "s"}.` +
        (found ? ` From the sheet: ${found}.` : "") +
        (hadSource ? "" : " Now copy the chord page's link and paste it too, to record the source."),
    );
  }, []);

  const pasteFallback = isTouch
    ? "Tap and hold the paste box below and choose Paste instead."
    : "Click the paste box below and press ⌘V (Ctrl+V) instead.";
  const pasteFromClipboard = () => {
    if (!navigator.clipboard?.readText) {
      setNotice(`This browser can't read the clipboard from a button. ${pasteFallback}`);
      return;
    }
    navigator.clipboard.readText().then(applyPasted, () =>
      setNotice(
        isTouch
          ? "Safari only allows this after you tap the small “Paste” bubble that pops up. " + pasteFallback
          : "The browser didn't allow reading the clipboard. " + pasteFallback,
      ),
    );
  };

  // Pasting into the song text when it's empty (or fully selected) gets the same cleanup.
  const onBodyPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const replacingAll = !el.value.trim() || (el.selectionStart === 0 && el.selectionEnd === el.value.length);
    const text = e.clipboardData.getData("text/plain");
    if (!replacingAll || !text) return;
    e.preventDefault();
    applyPasted(text);
  };

  // ⌘V anywhere on the page (outside a text box) pastes straight in.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;
      e.preventDefault();
      applyPasted(text);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [applyPasted]);

  const appUrl = location.origin + location.pathname;
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveSong({ ...draft, id: draft.id || newSongId(), title: draft.title.trim() || "Untitled" });
    location.hash = `#/song/${encodeURIComponent(saved.id)}`;
  };

  const remove = () => {
    if (!song) return;
    const msg = original ? "Discard your edits and restore the original song?" : `Delete "${song.title}"?`;
    if (!confirm(msg)) return;
    deleteSong(song.id);
    location.hash = original ? `#/song/${encodeURIComponent(song.id)}` : "#/";
  };

  return (
    <form className="page editor" onSubmit={save}>
      <h1>{song ? "Edit song" : "New song"}</h1>
      {song?.builtIn && <p className="muted">Saving creates your own copy; you can restore the original any time.</p>}

      <div className="form-grid">
        <label className="field wide">Title
          <input required value={draft.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="field wide">Artist
          <input value={draft.artist} onChange={(e) => set("artist", e.target.value)} />
        </label>
        <label className="field">Key
          <input value={draft.key ?? ""} placeholder="e.g. Am" onChange={(e) => set("key", e.target.value || undefined)} />
        </label>
        <label className="field">Capo
          <input type="number" min={0} max={12} value={draft.capo ?? ""} onChange={(e) => set("capo", num(e.target.value))} />
        </label>
        <label className="field">Tempo (BPM)
          <input type="number" min={30} max={300} value={draft.tempo ?? ""} onChange={(e) => set("tempo", num(e.target.value))} />
        </label>
        <label className="field">Beats per bar
          <input type="number" min={1} max={12} value={draft.beatsPerBar ?? ""}
            onChange={(e) => set("beatsPerBar", num(e.target.value))} />
        </label>
        <label className="field wide">Strumming pattern
          <input value={draft.strum ?? ""} placeholder="D - D U - U D U"
            title="One bar: D = down, U = up, - = skip, x = muted. Spaces optional."
            onChange={(e) => set("strum", e.target.value || undefined)} />
        </label>
        <label className="field">Length (m:ss)
          <input placeholder="3:30" defaultValue={draft.duration ? `${Math.floor(draft.duration / 60)}:${String(draft.duration % 60).padStart(2, "0")}` : ""}
            onChange={(e) => set("duration", parseDuration(e.target.value))} />
        </label>
      </div>

      {(draft.appleId || draft.mbid) && (
        <p className="source-line"><span className="source-ok">✓</span> Title, artist and length from{" "}
          {draft.appleId ? "Apple Music" : "MusicBrainz"}
          {draft.album ? <> · <i>{draft.album}</i></> : null}</p>
      )}

      {!song?.builtIn && (
        <div className="chord-source-panel">
          <div>
            <b>Chords from a published source</b>
            <p className="muted">
              Find this song's chord sheet or tab, paste it below, and save the page's link so you always know where the
              chords came from.
            </p>
            <div className="source-links">
              {chordSearchLinks(draft.title, draft.artist).map((l) => (
                <a key={l.label} className="btn" href={l.url} target="_blank" rel="noreferrer"
                  onClick={() => draft.id && setImportTarget(draft.id)}>{l.label} ↗</a>
              ))}
            </div>
            <div className="source-links paste-row">
              <button type="button" className="btn primary" onClick={pasteFromClipboard}>📋 Paste from clipboard</button>
            </div>
            <PasteBox label={isTouch ? "Or tap and hold here, then tap Paste" : "Or click here and press ⌘V"}
              onText={applyPasted} />
            <p className="muted paste-hint">Paste the chord sheet, then the page's link (in either order).</p>
            <details className="bookmarklet-help">
              <summary>⚡ One-click import from chord sites</summary>
              <ol>
                <li>
                  Drag this button to your bookmarks bar:{" "}
                  <a className="btn bookmarklet" ref={(el) => el?.setAttribute("href", bookmarkletSource(appUrl))}
                    onClick={(e) => {
                      e.preventDefault();
                      setNotice("Drag the “Send to Fretboard” button onto your bookmarks bar, then use it on a chord page.");
                    }}>
                    ⚡ Send to Fretboard
                  </a>{" "}
                  <button type="button" className="btn apple-small"
                    onClick={() => void navigator.clipboard?.writeText(bookmarkletSource(appUrl)).then(() =>
                      setNotice("Bookmark code copied. Make a new bookmark and paste it in as the address."))}>
                    Copy code
                  </button>
                </li>
                <li>Open the chord site from the buttons above, and go to the song's chord page.</li>
                <li>
                  Click <b>Send to Fretboard</b> in your bookmarks. It takes the chord sheet (or just the part you've
                  selected) and the page link, and brings them back here for this song.
                </li>
              </ol>
            </details>
          </div>
          <label className="field">Chord source link
            <input type="url" value={draft.chordSource ?? ""} placeholder="https://…"
              onChange={(e) => set("chordSource", e.target.value.trim() || undefined)} />
          </label>
        </div>
      )}

      {notice && (
        <p className="paste-notice" role="status">
          {notice} <button type="button" className="icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      <div className="editor-body-head">
        <div className="tabs">
          <button type="button" className={"tab" + (!preview ? " selected" : "")} onClick={() => setPreview(false)}>Write</button>
          <button type="button" className={"tab" + (preview ? " selected" : "")} onClick={() => setPreview(true)}>Preview</button>
        </div>
        <button type="button" className="btn" onClick={() => set("body", toInline(draft.body))}
          title="Rewrite chords-over-lyrics lines into [Chord] inline notation">
          Convert to inline chords
        </button>
      </div>

      {preview ? (
        <div className="editor-preview">
          <SongSheet rows={rows} transpose={0} fontSize={15} />
        </div>
      ) : (
        <textarea className="editor-body" value={draft.body} placeholder={PLACEHOLDER} spellCheck={false}
          onPaste={onBodyPaste}
          onChange={(e) => set("body", e.target.value)} rows={20} />
      )}

      <div className="editor-actions">
        <button className="btn primary" type="submit">Save</button>
        <a className="btn" href={song ? `#/song/${encodeURIComponent(song.id)}` : "#/"}>Cancel</a>
        {isUserCopy && (
          <button type="button" className="btn danger" onClick={remove}>
            {original ? "Restore original" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}

function parseDuration(v: string): number | undefined {
  const m = /^\s*(\d+)(?::(\d{1,2}))?\s*$/.exec(v);
  if (!m) return undefined;
  return m[2] === undefined ? Number(m[1]) * 60 : Number(m[1]) * 60 + Number(m[2]);
}
