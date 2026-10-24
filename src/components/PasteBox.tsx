import { findLink } from "../lib/importSheet";

/** Phones and tablets have no ⌘V, so they get tap-and-hold wording instead. */
export const isTouch = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

/**
 * A box that only takes pastes: tap and hold → Paste on a phone, or ⌘V on a computer.
 * This works everywhere, unlike reading the clipboard from a button (Safari refuses that
 * unless its own Paste bubble is tapped).
 */
export function PasteBox({ onText, label }: { onText: (text: string) => void; label?: string }) {
  return (
    <textarea
      className="paste-box"
      rows={2}
      value=""
      aria-label="Paste box"
      placeholder={label ?? (isTouch ? "Tap and hold here, then tap Paste" : "Click here and press ⌘V")}
      onPaste={(e) => {
        e.preventDefault();
        onText(e.clipboardData.getData("text/plain"));
        e.currentTarget.blur();
      }}
      // Some keyboards insert text without a paste event. Ignore ordinary typing.
      onChange={(e) => {
        const text = e.target.value;
        if (text.length > 20 || findLink(text)) onText(text);
      }}
    />
  );
}
