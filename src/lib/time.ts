/** Seconds as m:ss. */
export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
