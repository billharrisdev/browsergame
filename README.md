# Frequency Frontier

A click/tap rhythm game. Numbered targets appear with shrinking approach rings;
hit the center when the ring meets the target outline. No movement or frequency
switching is required.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Pick a song, optionally preview it, select a challenge,
and click **Play the beat**. A four-beat audible count-in precedes the song.

## Soundtrack

- **Genre Collection:** twelve new tracks, three each for Rock, Jazz, Punk, Metal.
- **Original Mix:** the previous twelve electronic, chiptune, and internet tracks.
- **Personal uploads:** audio stays on your device and gets a generated chart.

All 24 bundled recordings and their stored charts are included locally.
Credits are available in the song library and [MUSIC_CREDITS.md](MUSIC_CREDITS.md).
Recordings are CC BY 4.0, separate from the code's MIT license.

To restore recordings or regenerate charts:

```sh
npm run music:download
npm run music:charts
```

Chart generation requires **FFmpeg** on PATH. It decodes each recording to mono
PCM, detects bass/high-band attacks, follows an adaptive tempo grid, excludes
silent passages, and stores timestamps in `public/charts/`. Tempos without a
composer-provided value are estimated and marked `tempoSource: analysis`.
Charts are algorithmically generated, not manually authored or listening-verified;
they can be adjusted directly in JSON. Jazz swing, changing tempo, and ambiguous
attacks can need refinement. Uploaded music uses the same analysis at load time.

## Timing and scoring

| Error from target time | Judgment |
| --- | --- |
| Within ±45 ms | Perfect |
| Within ±100 ms | Close, with early/late feedback |
| 100–180 ms early | Early |
| 100–180 ms late | Late |
| More than 180 ms early | Too early; target remains hittable |
| More than 180 ms late / no tap | Miss |
| Click away from a target | No target |

Every attempt shows localized feedback and a signed timing indicator. The timing
meter plots recent hits: early on the left, late on the right. Perfect and Close
build a combo and up to ×5 score multiplier. Inaccurate, premature, and empty
clicks break combos; repeated clicking cannot earn duplicate points. Weighted
accuracy rewards precise hits and accounts for off-window attempts.

The entire song is playable regardless of misses. Results include judgment counts,
accuracy, mean early/late offset, best combo, and personal best per song/difficulty.
Click-game scores use a new namespace so old exploration scores are not compared.

- **Mouse / touch:** hit targets. No movement keys or mode shortcuts.
- **Space:** pause/resume. **R:** retry after results.
- Targets also expose focusable buttons; Enter/Space can activate a focused target.
- Losing focus automatically pauses. Resume preserves song and target timing.
- Settings: volume, visual intensity, reduced motion, and ±200 ms calibration.
- Reduced motion disables decorative flashes/expansions, preserving functional
  approach rings and progress arcs.

Pointer-down timestamps are mapped to audible output time using Web Audio's
`getOutputTimestamp`, with a latency-based fallback. Visuals and judgments use
that same timeline; input is not rounded to animation frames. Positive calibration
offset advances targets and judges taps later; negative offset does the reverse.

## Development

```sh
npm test
npm run lint
npm run build
npm start
```

- `components/GameContainer.tsx`: collections, loading, settings, credits, bests
- `components/GameUI.tsx`: target input overlays, HUD, timing meter, results
- `lib/game-engine/audioProcessor.ts`: playback, count-in, output clock, spectrum
- `lib/game-engine/rhythm.ts`: chart analysis and timing judgments
- `lib/game-engine/gameWorld.ts`: target lifetime and click resolution
- `lib/game-engine/scoring.ts`: combos and accuracy
- `lib/game-engine/game.ts`: lifecycle and high-DPI Canvas rendering
- `lib/music/tracks.json`: multi-artist metadata and download/source links

The renderer and audio playback have no external CDN startup dependencies.
