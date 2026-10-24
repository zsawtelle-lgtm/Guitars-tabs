import { useEffect, useState } from "react";

type Browser = "safari" | "chrome";

// Toggles Music, then sets the page to match whether Music is now playing,
// so the two can never end up out of step.
function script(browser: Browser): string {
  const run =
    browser === "safari"
      ? `tell application "Safari" to do JavaScript js in current tab of front window`
      : `tell application "Google Chrome" to execute active tab of front window javascript js`;
  return `tell application "Music"
\tset wasPlaying to (player state is playing)
\tplaypause
end tell
if wasPlaying then
\tset js to "window.fretboard && window.fretboard.pause()"
else
\tset js to "window.fretboard && window.fretboard.play()"
end if
${run}`;
}

const ENABLE: Record<Browser, string> = {
  safari:
    "In Safari, turn on Settings → Advanced → “Show features for web developers”, then tick Develop → “Allow JavaScript from Apple Events”.",
  chrome: "In Chrome, tick View → Developer → “Allow JavaScript from Apple Events”.",
};

export function MacShortcutHelp({ onClose }: { onClose: () => void }) {
  const [browser, setBrowser] = useState<Browser>("safari");
  const [copied, setCopied] = useState(false);
  const text = script(browser);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="One-key start on Mac">
        <button className="modal-close icon-btn" onClick={onClose} aria-label="Close">×</button>
        <h2 className="help-title">One-key start on Mac</h2>
        <p className="muted">
          One keyboard shortcut presses play in the Music app and starts this page's autoscroll at the same moment.
          Pressing it again pauses both.
        </p>

        <div className="segmented" role="group" aria-label="Browser">
          <button type="button" className={browser === "safari" ? "selected" : ""} onClick={() => setBrowser("safari")}>Safari</button>
          <button type="button" className={browser === "chrome" ? "selected" : ""} onClick={() => setBrowser("chrome")}>Chrome</button>
        </div>

        <ol className="help-steps">
          <li>{ENABLE[browser]}</li>
          <li>Open the <b>Shortcuts</b> app, make a new shortcut, and add a <b>Run AppleScript</b> action.</li>
          <li>
            Replace its contents with this script:
            <pre className="help-script">{text}</pre>
            <button type="button" className="btn" onClick={copy}>{copied ? "Copied ✓" : "Copy script"}</button>
          </li>
          <li>Click the shortcut's ⓘ (Details) and choose <b>Add Keyboard Shortcut</b>, e.g. ⌃⌥Space.</li>
          <li>
            To play: tap <b>Open in Apple Music</b> so the song is loaded (paused), come back to this tab, then press
            your shortcut. The first time, macOS asks to allow Shortcuts to control Music and {browser === "safari" ? "Safari" : "Chrome"}.
          </li>
        </ol>
        <p className="muted help-note">
          The song page needs to be the front tab of the front {browser === "safari" ? "Safari" : "Chrome"} window.
        </p>
      </div>
    </div>
  );
}
