import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { metronome } from "./metronome";

/** Autoscroll speed level (1–10) to pixels per second at the default 16px font. */
export function speedToPxPerSec(speed: number): number {
  return 6 * Math.pow(1.38, speed - 1);
}

export function pxPerSecToSpeed(px: number): number {
  return 1 + Math.log(px / 6) / Math.log(1.38);
}

/**
 * Scrolls the window smoothly while `active`. Sub-pixel progress is accumulated so
 * slow speeds still move, and manual scrolling during playback just works.
 */
export function useAutoScroll(active: boolean, pxPerSec: number, onEnd: () => void) {
  const speedRef = useRef(pxPerSec);
  speedRef.current = pxPerSec;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      // Cap dt so returning to a background tab doesn't jump the page.
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += speedRef.current * dt;
      const whole = Math.floor(acc);
      if (whole >= 1) {
        window.scrollBy(0, whole);
        acc -= whole;
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        onEndRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/** Keeps the screen on while `active` (where the Wake Lock API is supported). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    // Locks are dropped when the tab is hidden; take it back when we return.
    const onVisible = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

// Metronome state as a React store.
const metroSubs = new Set<() => void>();
let metroVersion = 0;
export function notifyMetronome() {
  metroVersion++;
  metroSubs.forEach((fn) => fn());
}

export function useMetronome() {
  useSyncExternalStore(
    (fn) => {
      metroSubs.add(fn);
      return () => metroSubs.delete(fn);
    },
    () => metroVersion,
  );
  return metronome;
}

/** Current beat (or -1 when stopped), for visual pulses. */
export function useBeat(): number {
  const [beat, setBeat] = useState(-1);
  const m = useMetronome();
  useEffect(() => metronome.onBeat((b) => setBeat(b)), []);
  return m.running ? beat : -1;
}
