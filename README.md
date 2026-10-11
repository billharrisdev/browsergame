# Frequency Frontier

A browser rhythm-exploration game: move through a neon spectrum landscape,
switch frequency, collect musical shapes, and build a resonance combo.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Twelve locally hosted, CC BY 4.0 recordings are
included in `public/music/`. To restore them:

```sh
npm run music:download
```

## Play

- Pick a song, preview up to 20 seconds, select a challenge, then start.
- Move with mouse, touch, **WASD**, or **arrow keys**.
- **1 — Bass** (square): slower movement, phases through orange hazards.
- **2 — Mid** (circle): balanced movement.
- **3 — High** (diamond): faster movement, takes more damage.
- Match the numbered collectible's mode and intercept it on the vertical beat
  line for Perfect/Good timing. Other collections still score.
- Matched timed collections build a combo and a multiplier up to ×5. Every 16
  earns a four-second resonance burst: double points, protection, and healing.
- Missing a collectible breaks the combo but does not cost health.
- **Space** pauses/resumes; **R** retries a finished run. Losing window focus
  automatically pauses. Mobile players can use the on-screen mode buttons.
- Finish the song for results; personal bests are saved per song and difficulty.

Settings include volume, effect intensity, reduced motion, and ±200 ms timing
adjustment. Reduced-motion system preferences are respected. Music credits are
available from the song library.

## Audio and timing

Native Web Audio provides decoding, playback, real spectrum analysis, and an
audio-clock timeline shared by encounters and visuals. Pause/resume preserves
the playback offset; restart rewinds both music and world.

Bundled BPMs come from the composer catalog. The audio's positive energy changes
estimate beat phase at load time; individual beats snap to nearby attacks within
60 ms of that grid. Pixelland uses a 115 BPM half-time gameplay
pulse. Uploaded audio stays on-device; onset-envelope autocorrelation estimates
tempo. These are estimated regular beat grids, not hand-authored beat maps:
swung rhythms, tempo changes, or weak attacks can be less precise. Timing offset
can adjust alignment. Low-confidence uploads still have spectrum-reactive
visuals and a playable estimated grid.

The renderer uses high-DPI Canvas 2D and has no external CDN/library startup
dependencies. Encounters follow deterministic phrase-based routes with advance
visibility. Particle counts and React HUD updates are bounded.

## Development

```sh
npm test          # beat estimation, playback lifecycle, encounters, scoring
npm run lint     # TypeScript check
npm run build    # production build
npm run start    # serve production build
```

Main files:

- `components/GameContainer.tsx`: library, loading, settings, credits, best scores
- `components/GameUI.tsx`: HUD, touch mode controls, pause and results
- `lib/game-engine/audioProcessor.ts`: native playback and spectrum analysis
- `lib/game-engine/rhythm.ts`: beat estimation and timing windows
- `lib/game-engine/game.ts`: game lifecycle, controls, collision and rendering
- `lib/game-engine/gameWorld.ts`: deterministic musical encounters
- `lib/game-engine/player.ts`: movement, scoring and resonance
- `lib/music/tracks.json`: soundtrack metadata

See [MUSIC_CREDITS.md](MUSIC_CREDITS.md) for licenses and sources. The application
code's license does not replace the recordings' attribution license.
