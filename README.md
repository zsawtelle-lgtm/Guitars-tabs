# Fretboard — guitar chords, tabs & autoscroll

A chord and tab viewer in the spirit of Ultimate Guitar, built for playing along in real time.

## Features

- **Song sheets**: chords above lyrics, section headers, and tab staff notation. Tap any chord to see its diagram and alternate voicings.
- **Autoscroll**: a play/pause button with speed from 0.5 to 10 (−/+ buttons or a fine slider). **Fit to song length** sets the speed so the rest of the song scrolls in the song's duration. Speed is remembered per song, and the screen stays awake while scrolling.
- **Metronome**: sample-accurate Web Audio clicks, 30–300 BPM, 1–12 beats per bar, accented downbeat, tap tempo, and a visual beat. Opening a song presets the tempo, and the metronome keeps running as you move between pages.
- **Tab timing** (toggle): each tab section gets a ▶ button, progress bar and Bar/Beat readout. A cursor sweeps across the tab in time with the metronome, after a one-bar count-in. During autoscroll, scrolling pauses at a tab, plays it in time, then carries on.
- **Highlight progress** (toggle): the line you're on is highlighted, lines already played are dimmed, and a thin bar above the toolbar shows how far through the song you are.
- **Transpose** by semitone. Chords, the key and the diagrams all update, with barre shapes generated for any key.
- **Chord library**: all 12 roots × 16 chord types, with multiple voicings.
- **Your songs**: add or edit songs (edits to built-in songs are saved as your own copy). Paste chords-over-lyrics text straight from a website and it's understood as-is. Favorites and search.
- Dark and light themes, and a layout that works on phones.

Everything is saved in the browser (localStorage). No account or server is needed.

### Keyboard shortcuts (song page)

| Key | Action |
| --- | --- |
| `Space` | Start/pause autoscroll |
| `+` / `-` | Scroll faster / slower |
| `]` / `[` | Transpose up / down |
| `M` | Start/stop metronome |

## Song format

Both notations work, and you can mix them:

```
[Verse 1]
[Am]There is a [C]house in [D]New Or[F]leans

Am        C          D
They call the Rising Sun

  Am           C
e|------0-----|------0-----|
B|----1---1---|----1---1---|
```

A chord line directly above a tab names the chords in it. For tab timing, each measure (between `|` bar lines) lasts one bar of the song's time signature, so space the notes evenly within each bar.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # unit tests (parser, transposition, chord shapes)
npm run build    # typecheck + production build into dist/
```

The build is a static site (`dist/`) that can be hosted anywhere, e.g. GitHub Pages or Netlify.

Built-in songs are traditional / public-domain.
