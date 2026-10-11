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

## Levels and drum sticks

| Level | Practice |
| --- | --- |
| 1 · Pulse | Quarter notes; either stick works |
| 2 · Eighths | Two alternating practice cycles, then **R L R R · L R L L** in eighth notes |
| 3 · Sixteenths | The same progression at sixteenth-note spacing |

Aim with the mouse: **left-click = L**, **right-click = R**. The context menu is
suppressed only on the active playfield. Alternatively, **Left Ctrl = L** and
**Right Ctrl = R** automatically strike the upcoming due target, regardless of
cursor position. Each stroke needs a fresh press; release between doubles.
L/R on-screen pads provide the same automatic targeting for touch input.

Targets show their required hand and the pattern strip highlights the next
stroke. Doubles stay at the same pad. Wrong-stick hits consume the due note and
break the combo, but preserve timing feedback (e.g. Perfect timing, wrong L stick).
Timing and sticking accuracy are reported separately.

The upper-right counter shows total quarter-note beats, cycle position, and
`1 & 2 & 3 & 4 &` or `1 e & a ...` subdivisions. Counter, targets, judgments, and
optional beat click share the audible-output timeline. Unverified groupings are
marked estimated; cycle numbering is a practice grouping, not a claim that the
recording's musical downbeat has been manually established. The metal waltz uses
three-beat grouping; paradiddle cycles continue across measure boundaries.

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
PCM, detects bass/high-band attacks, fits fractional tempo and beat phase over the
recording, and stores a **stable quarter-note grid** in `public/charts/`. Detected
attacks identify active measures and diagnose alignment; individual beats are no
longer snapped to nearby peaks. Tempos without a
composer-provided value are estimated and marked `tempoSource: analysis`.
Charts are algorithmically generated, not manually authored or listening-verified;
they can be adjusted directly in JSON. Jazz swing, changing tempo, and ambiguous
attacks can need refinement. Uploaded music uses the same analysis at load time.
Charts include beginning/middle/end residual diagnostics against detected attacks.
These diagnostics are not listening verification. Optional `beatOffset`,
`beatsPerBar`, `meterVerified`, and explicit `tempoMap: [{startTime, bpm}, ...]`
metadata in `lib/music/tracks.json` support per-song corrections and deliberate
tempo changes when regenerating charts. Charts use schema version 3.

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
| Correct timing, incorrect required hand | Wrong stick, with original timing feedback |

These are maximum windows. Dense subdivisions cap the hit window at half the
neighboring stroke spacing; Perfect/Close windows shrink proportionally, as
shown in the HUD. This prevents sixteenth notes from stealing adjacent strokes.

Every attempt shows localized feedback and a signed timing indicator. The timing
meter plots recent hits: early on the left, late on the right. Perfect and Close
build a combo and up to ×5 score multiplier. Inaccurate, premature, and empty
clicks break combos; repeated clicking cannot earn duplicate points. Weighted
accuracy rewards precise hits and accounts for off-window attempts.

The entire song is playable regardless of misses. Results include judgment counts,
accuracy, mean early/late offset, best combo, and personal best per song/difficulty.
Stick-game scores use a new namespace so earlier chart/density scores are not compared.

- **Mouse:** aim + left/right click. **Left/Right Ctrl:** automatically hit with L/R.
- **Touch:** use the L/R pads. Level 1 also accepts ordinary target taps.
- **Space:** pause/resume. **R:** retry after results.
- Targets also expose focusable buttons; Enter/Space can activate a focused target.
- Losing focus automatically pauses. Resume preserves song and target timing.
- Settings: volume, visual intensity, reduced motion, beat click, and ±200 ms calibration.
- Calibration and beat-click preference persist locally across reloads.
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
- `components/GameUI.tsx`: beat counter, pattern strip, stick pads, timing meter, results
- `lib/game-engine/audioProcessor.ts`: playback, phase-aligned count-in, metronome, output clock
- `lib/game-engine/rhythm.ts`: chart analysis and timing judgments
- `lib/game-engine/gameWorld.ts`: target lifetime and click resolution
- `lib/game-engine/scoring.ts`: combos and accuracy
- `lib/game-engine/game.ts`: lifecycle and high-DPI Canvas rendering
- `lib/music/tracks.json`: multi-artist metadata and download/source links

The renderer and audio playback have no external CDN startup dependencies.
