# Frequency Frontier setup

Requires Node.js 20.9 or newer (Next.js 16).

```sh
npm install
npm run dev
```

Open http://localhost:3000, select a song, and click **Start exploring**.
Audio starts after a three-second countdown. The song library includes previews
and a **Music credits** screen. No microphone permission is needed.

The twelve recordings are served locally from `public/music/`. Restore missing
files with `npm run music:download`. An individual uploaded track stays in the
browser and is not sent to a server.

## Production

```sh
npm test
npm run lint
npm run build
npm start
```

The app uses Next.js, React, TypeScript, native Canvas 2D, and native Web Audio.
Serve it through Next.js; the old standalone `index.html` is not the app entry.
There are no external graphics/audio scripts to load.

See [README.md](README.md) for controls and timing behavior, and
[MUSIC_CREDITS.md](MUSIC_CREDITS.md) for recording licenses and source links.
