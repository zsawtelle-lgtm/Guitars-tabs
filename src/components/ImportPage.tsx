import { useMemo, useState } from "react";
import { cleanSheet, decodeImport, describeMeta, extractMeta, titleFromPage } from "../lib/importSheet";
import { groupRows, parseSong } from "../lib/parser";
import { getImportTarget, getSong, getSongs, newSongId, saveSong, useStoreVersion } from "../lib/storage";
import { SongSheet } from "./SongSheet";

const NEW = "__new__";

export function ImportPage({ encoded }: { encoded: string }) {
  useStoreVersion();
  const payload = useMemo(() => decodeImport(encoded), [encoded]);
  const { body, meta } = useMemo(() => extractMeta(cleanSheet(payload?.text ?? "")), [payload]);
  const rows = useMemo(() => groupRows(parseSong(body)), [body]);
  const songs = getSongs();
  const fromPage = titleFromPage(payload?.title ?? "");
  const initialTarget = getImportTarget();
  const [target, setTarget] = useState(initialTarget && getSong(initialTarget) ? initialTarget : NEW);
  const [title, setTitle] = useState(fromPage.title ?? "");
  const [artist, setArtist] = useState(fromPage.artist ?? "");

  if (!payload) {
    return (
      <div className="page">
        <h1>Nothing to import</h1>
        <p className="muted">The chord sheet didn't come through. Go back to the chord page and click the bookmark again.</p>
        <a className="btn" href="#/">Back to songs</a>
      </div>
    );
  }

  const host = payload.url ? new URL(payload.url).hostname.replace(/^www\./, "") : null;
  const existing = target === NEW ? undefined : getSong(target);
  const found = describeMeta(meta);

  const doImport = () => {
    const base = existing ?? { id: newSongId(), title: title.trim() || "Untitled", artist: artist.trim(), body: "" };
    const saved = saveSong({
      ...base,
      body,
      chordSource: payload.url ?? base.chordSource,
      key: meta.key ?? base.key,
      capo: meta.capo ?? base.capo,
      tempo: meta.tempo ?? base.tempo,
    });
    // Replace (not push) the import address, so Back or a reload can't import it twice.
    location.replace(`#/song/${encodeURIComponent(saved.id)}`);
  };

  return (
    <div className="page import-page">
      <h1>Import chord sheet</h1>
      <p className="source-line">
        {host ? (
          <span>From <a href={payload.url} target="_blank" rel="noreferrer">{host} ↗</a></span>
        ) : (
          <span className="muted">No source link came with it.</span>
        )}
        <span className={found ? "" : "muted"}>{found ? `The sheet lists: ${found}` : "The sheet doesn't list a key, capo or tempo."}</span>
      </p>

      <div className="import-target">
        <label className="field">Add to
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value={NEW}>New song</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>{s.title}{s.artist ? ` — ${s.artist}` : ""}</option>
            ))}
          </select>
        </label>
        {target === NEW && (
          <>
            <label className="field">Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="field">Artist<input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          </>
        )}
        <button type="button" className="btn primary" onClick={doImport}>
          {existing ? `Add chords to “${existing.title}”` : "Create song"}
        </button>
      </div>
      {existing?.body.trim() && <p className="muted">This replaces the chords currently in “{existing.title}”.</p>}

      <div className="editor-preview">
        <SongSheet rows={rows} transpose={0} fontSize={15} />
      </div>
    </div>
  );
}
