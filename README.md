# Fretboard — guitar chords, tabs & autoscroll

A chord and tab viewer in the spirit of Ultimate Guitar, built for playing along in real time.

## Features

- **Song sheets**: chords above lyrics, section headers, and tab staff notation. Tap any chord to see its diagram and alternate voicings.
- **Autoscroll**: a play/pause button with speed from 0.5 to 10 (−/+ buttons or a fine slider). **Fit to song length** sets the speed so the rest of the song scrolls in the song's duration. Speed is remembered per song, and the screen stays awake while scrolling.
- **Metronome**: sample-accurate Web Audio clicks, 30–300 BPM, 1–12 beats per bar, accented downbeat, tap tempo, and a visual beat. Opening a song presets the tempo, and the metronome keeps running as you move between pages.
- **Tab timing** (toggle): each tab section gets a ▶ button, progress bar and Bar/Beat readout. A cursor sweeps across the tab in time with the metronome, after a one-bar count-in. Each tab has a **Song / Loop** switch:
  - **Song**: during autoscroll, scrolling pauses at the tab, plays it once in time, then carries on.
  - **Loop**: ▶ repeats just that section until you stop it, at 50%, 75% or 100% tempo, for learning it. Autoscroll scrolls past it.
- **Highlight progress** (toggle): the line you're on is highlighted, along with the word you're on (words already sung change color), lines already played are dimmed, and a thin bar above the toolbar shows how far through the song you are.
- **Strumming patterns**: each song can have one bar of strumming (e.g. `D - D U - U D U`; D down, U up, - skip, x muted). It's shown as ↓ ↑ arrows with beat counts. ▶ loops it at the song's BPM on a synthesized guitar playing the chord you pick, with the current stroke lit up, an optional click, and −/+ tempo.
- **Play along with a recording**: paste a YouTube link on any song (or use **Search YouTube** to find one). The toolbar ▶ then plays the recording, and the song scrolls and highlights in step with it. You can slow it to 0.5× or 0.75× for practice, and set where the lyrics start and end in the video so intros and outros don't throw off the sync. On wide screens the video docks in the corner once you scroll past it.
- **Apple Music link**: save a song's Apple Music link (Share → Copy Link in Music) to get an **Open in Apple Music** button, which plays it from your own library in the Music app on iPhone, iPad or Mac. There's also a Search Apple Music shortcut. The app can't see what the Music app is playing, so start autoscroll yourself, or use **⌨ One-key start (Mac)**: a Shortcuts/AppleScript key combo that presses play in Music and starts the page's autoscroll at the same moment. The page provides `window.fretboard.play() / pause() / toggle()` for this.
- **Transpose** by semitone. Chords, the key and the diagrams all update, with barre shapes generated for any key.
- **Chord library**: all 12 roots × 16 chord types, with multiple voicings.
- **Add from Apple Music**: search Apple's public catalog (no login needed). The title, artist, album, artwork, length and Apple Music link come straight from Apple, and results already in your songs are flagged. Tempo and key are left blank because Apple doesn't publish them.
- **Sourced chords**: the editor links to Ultimate Guitar, Songsterr and a web search for that exact song. You paste a published chord sheet and save its link, and each song shows where its info and chords came from. Built-in songs are labeled as arrangements written for this app.
- **Import chord sheets**: copy a sheet on the chord site and press ⌘V on the editor (or tap **Paste from clipboard**). The sheet is cleaned up, and any Key / Capo / BPM it lists fills those fields. Paste the page link the same way to save it as the source. On desktop, the **⚡ Send to Fretboard** bookmark does it in one click: on a chord page it takes the sheet (or your selection) and the page link and imports them into the song you opened the site from.
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
