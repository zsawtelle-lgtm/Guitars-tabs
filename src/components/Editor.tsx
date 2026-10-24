import { useMemo, useState } from "react";
import { deleteSong, newSongId, saveSong, type Song } from "../lib/storage";
import { BUILT_IN_SONGS } from "../data/songs";
import { parseSong, toInline } from "../lib/parser";
import { SongSheet } from "./SongSheet";

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
  const lines = useMemo(() => parseSong(draft.body), [draft.body]);
  const original = song && BUILT_IN_SONGS.find((s) => s.id === song.id);
  const isUserCopy = song && !song.builtIn;

  const set = <K extends keyof Song>(key: K, value: Song[K]) => setDraft((d) => ({ ...d, [key]: value }));
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
        <label className="field">Length (m:ss)
          <input placeholder="3:30" defaultValue={draft.duration ? `${Math.floor(draft.duration / 60)}:${String(draft.duration % 60).padStart(2, "0")}` : ""}
            onChange={(e) => set("duration", parseDuration(e.target.value))} />
        </label>
      </div>

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
          <SongSheet lines={lines} transpose={0} fontSize={15} />
        </div>
      ) : (
        <textarea className="editor-body" value={draft.body} placeholder={PLACEHOLDER} spellCheck={false}
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
