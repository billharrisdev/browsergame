# Frequency Frontier setup

Requires Node.js 20.9 or newer (Next.js 16).

```sh
npm install
npm run dev
```

Open http://localhost:3000. Select a song and click **Play the beat**.
Listen to the four-beat count-in, then click or tap the numbered targets when
their shrinking rings meet their outlines. Feedback shows early/late offset,
Close, Perfect, and misses.

Twenty-four local recordings and their charts are bundled. To restore files:

```sh
npm run music:download
npm run music:charts
```

The chart-generation command requires FFmpeg on PATH. It writes derived charts
and updates estimated tempo/duration metadata. Normal gameplay does not require
FFmpeg. Stored charts are generated, not manually listening-verified.

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
