# Frequency Frontier setup

Requires Node.js 20.9 or newer (Next.js 16).

```sh
npm install
npm run dev
```

Open http://localhost:3000 and click **Start playing**. The default song,
Feel Good Rock, and level 1 are ready immediately; the play card is above the
song library. Changing tracks preserves your chosen level.
Listen to the phase-aligned count-in, then hit targets when their rings close.
Aim + left/right mouse click for L/R sticks, or use Left/Right Ctrl to strike the
next target automatically. Release between strokes. Touch users can use L/R pads.
The corner counter shows beats/subdivisions; its Click toggle enables a metronome.

Level 1 is a quarter-note pulse. Level 2 introduces the basic R L R R · L R L L
paradiddle in eighth notes, and level 3 progresses to sixteenths. Feedback reports
timing and whether the correct stick was used.

Twenty-four local recordings and their charts are bundled. To restore files:

```sh
npm run music:download
npm run music:charts
```

The chart-generation command requires FFmpeg on PATH. It writes derived charts
and updates estimated tempo/duration metadata. Normal gameplay does not require
FFmpeg. Stored charts are generated, not manually listening-verified.
Version 3 charts use stable beat grids and fractional tempo fitting, with
alignment diagnostics at the beginning, middle, and end of each recording.
Timing calibration is available in Settings and persists across reloads.

## Production

```sh
npm test
npm run lint
npm run build
npm start
```

Serve the app through Next.js; the old standalone `index.html` is not the app
entry. See [README.md](README.md) for timing/scoring details and
[MUSIC_CREDITS.md](MUSIC_CREDITS.md) for recording licenses.
