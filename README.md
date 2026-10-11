# Frequency Frontier

A click/tap rhythm game. Numbered targets appear with shrinking approach rings;
hit the center when the ring meets the target outline. No movement or frequency
switching is required.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000 and click **Start playing**. **Feel Good Rock** and
**Level 1 · Pulse** are preselected. The play card, difficulty, and essential
controls appear before the song library. A four-beat audible count-in precedes
the song. Browsing songs or collections preserves your selected level.

## Levels and drum sticks

| Level | Practice |
| --- | --- |
| 1 · Pulse | Quarter notes; either stick works. Every song |
| 2 · Eighths | Two alternating practice cycles, then **R L R R · L R L L**. Straight-feel songs |
| 3 · Triplets | Three equal notes per beat, free-form on any pad, any stick. Triplet-feel songs |
| 4 · Coming soon | Placeholder; not playable |
| 5 · Sixteenths | Reserved for a future sixteenth paradiddle; not playable |

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
`1 & 2 &`, `1 trip let`, or a future sixteenth count. Soft color washes and
strong-beat splashes pulse hardest on beat 1, with a smaller accent on beat 3.
Reduced motion keeps a static wash. The song list filters to recordings tagged
for the selected level. **Bebop 25** is tagged for triplets from listening;
**Big Swing Band** is tagged from its swing title, not a fresh listening pass.
Uploads use a straight grid and fit levels 1 and 2. Counter, targets, judgments, and
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
| Within ±54 ms | Perfect |
| Within ±120 ms | Close, with early/late feedback |
| 120–216 ms early | Early |
| 120–216 ms late | Late |
| More than 216 ms early | Too early; target remains hittable |
| More than 216 ms late / no tap | Miss |
| Click away from a target | No target |
| Correct timing, incorrect required hand | Wrong stick, with original timing feedback |

The maximum grading/acceptance windows are 20% wider than the original settings.
Dense subdivisions retain the half-neighbor-spacing safety cap; their original
Perfect/Close bands grow by 20% up to that cap. At 120 BPM, sixteenths allow
±37.5 ms Perfect and ±62.5 ms Close/accepted hits. Signed early/late feedback
still appears on those Close hits. The HUD labels and meter bands use the same
thresholds as judging, expiration, and delayed-input recovery.
Small MP3-decoder differences in end padding trim only trailing chart timestamps;
compatible stored charts preserve their beat phase instead of being regenerated.

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
