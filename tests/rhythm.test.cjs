const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

// Run source directly without a second build tree or additional test dependency.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
}
const { analyzeBeats, buildSongChart, makeBeatGrid, makeTempoGrid, beatPosition, controlStick, nearestBeatDistance, paradiddle, timingGrade, timingWindows, describeTiming } = require('../lib/game-engine/rhythm.ts')
const { createTargets, GameWorld } = require('../lib/game-engine/gameWorld.ts')
const { RunScore } = require('../lib/game-engine/scoring.ts')
const { AudioProcessor } = require('../lib/game-engine/audioProcessor.ts')

function pulseTrain(bpm, phase = 0.12, duration = 30) {
  const sampleRate = 1000
  const samples = new Float32Array(sampleRate * duration)
  for (let beat = phase; beat < duration; beat += 60 / bpm) {
    for (let i = 0; i < 20; i++) samples[Math.round(beat * sampleRate) + i] = Math.sin(i * 2) * (1 - i / 20)
  }
  return { samples, sampleRate }
}

test('bundled tempo locks phase to audio attacks, including half-time songs', () => {
  const { samples, sampleRate } = pulseTrain(120)
  const map = analyzeBeats(samples, sampleRate, 120)
  assert.equal(map.bpm, 120)
  assert.ok(nearestBeatDistance(5.12, map) < 0.025, `phase: ${map.offset}`)
  assert.equal(analyzeBeats(samples, sampleRate, 230).bpm, 115)
})

test('uploaded steady pulses infer tempo and silence has zero confidence', () => {
  const { samples, sampleRate } = pulseTrain(120)
  const map = analyzeBeats(samples, sampleRate)
  assert.ok(Math.abs(map.bpm - 120) <= 2, `inferred ${map.bpm}`)
  assert.ok(map.confidence > 0)
  assert.equal(analyzeBeats(new Float32Array(10000), 1000).confidence, 0)
})

test('timing windows are symmetric and beat distance wraps across phase', () => {
  assert.equal(timingGrade(-0.054), 'Perfect')
  assert.equal(timingGrade(0.054), 'Perfect')
  assert.equal(timingGrade(0.054001), 'Close')
  assert.equal(timingGrade(-0.12), 'Close')
  assert.equal(timingGrade(0.12), 'Close')
  assert.equal(timingGrade(0.120001), 'Late')
  assert.equal(timingGrade(-0.216), 'Early')
  assert.equal(timingGrade(0.216), 'Late')
  assert.equal(timingGrade(-0.216001), 'Too early')
  assert.equal(timingGrade(0.216001), 'Miss')
  assert.equal(describeTiming('Close', -75), 'Close · 75 ms early')
  assert.equal(describeTiming('Perfect', 0), 'Perfect · on time')
  const map = { bpm: 120, offset: 0.1, beats: [], confidence: 1 }
  assert.ok(Math.abs(nearestBeatDistance(1.09, map) - 0.01) < 1e-8)
  assert.ok(Math.abs(nearestBeatDistance(1.11, map) - 0.01) < 1e-8)
  const expressive = { ...map, beats: [0.1, 0.62, 1.09, 1.61] }
  assert.equal(nearestBeatDistance(1.09, expressive), 0)
  assert.ok(Math.abs(nearestBeatDistance(1.11, expressive) - 0.02) < 1e-8)
})

test('20% wider grading bands stay inside dense-note safety caps', () => {
  const normal = timingWindows()
  assert.ok(Math.abs(normal.perfect - 0.054) < 1e-10)
  assert.ok(Math.abs(normal.close - 0.12) < 1e-10)
  assert.ok(Math.abs(normal.hit - 0.216) < 1e-10)
  const dense = timingWindows(0.0625)
  assert.ok(Math.abs(dense.perfect - 0.0375) < 1e-10)
  assert.equal(dense.close, 0.0625)
  assert.equal(dense.hit, 0.0625)
  assert.equal(timingGrade(0.034, dense.hit), 'Perfect')
  assert.equal(timingGrade(0.057, dense.hit), 'Close')
  assert.equal(timingGrade(0.062501, dense.hit), 'Miss')
  assert.equal(timingGrade(-0.062501, dense.hit), 'Too early')
})

test('a 200ms late hit is accepted before the widened expiry deadline', () => {
  const map = { bpm: 120, offset: 0, beats: [2, 2.5, 3], confidence: 1 }
  const world = new GameWorld(map, 5, 'Easy')
  const target = world.targets[0]
  world.update(2.2)
  assert.equal(world.stats.counts.Miss, 0)
  assert.equal(world.hit(target.x, target.y, 2.2, 800, 500, 42).grade, 'Late')
  world.update(2.23)
  assert.equal(world.stats.counts.Miss, 0)
  assert.equal(world.stats.counts.Late, 1)
})

test('targets are deterministic, difficulty changes density, and timing stays on the chart', () => {
  const map = { bpm: 120, offset: 0.1, beats: makeBeatGrid(60, 120, 0.1), confidence: 1 }
  const easy = createTargets(map, 60, 'Easy')
  const hard = createTargets(map, 60, 'Hard')
  assert.deepEqual(hard, createTargets(map, 60, 'Hard'))
  assert.ok(hard.length > easy.length)
  assert.ok(hard.every(e => e.time >= 1.5 && e.time < 59.6 && e.y > 0.2 && e.y < 0.8))
  assert.ok(easy.every(e => map.beats.includes(e.time)))
  assert.ok(hard.every(e => Math.abs(((e.time - map.offset) / 0.125) - Math.round((e.time - map.offset) / 0.125)) < 1e-6))
})

test('good timing builds combos; inaccurate and empty attempts affect accuracy', () => {
  const stats = new RunScore()
  for (let i = 0; i < 10; i++) stats.record('Perfect', 20)
  assert.equal(stats.combo, 10)
  assert.equal(stats.multiplier, 2)
  assert.equal(stats.accuracy, 100)
  stats.record('Late', 160)
  assert.equal(stats.combo, 0)
  assert.ok(stats.accuracy < 100)
  const accuracy = stats.accuracy
  stats.record('No target', null)
  assert.ok(stats.accuracy < accuracy)
  assert.equal(stats.bestCombo, 10)
})

test('too-early input leaves target hittable; duplicate taps cannot score twice', () => {
  const map = { bpm: 120, offset: 0, beats: [2, 2.5, 3], confidence: 1 }
  const world = new GameWorld(map, 5, 'Easy')
  const target = world.targets[0]
  assert.equal(world.hit(target.x, target.y, 1.5, 800, 500, 42).grade, 'Too early')
  assert.equal(target.resolved, false)
  assert.equal(world.hit(target.x, target.y, 2.02, 800, 500, 42).grade, 'Perfect')
  const score = world.stats.score
  assert.equal(world.hit(target.x, target.y, 2.03, 800, 500, 42).grade, 'No target')
  assert.equal(world.stats.score, score)
  assert.equal(world.stats.counts.Perfect, 1)
})

test('input captured inside the window is valid even when dispatched after a timeout frame', () => {
  const map = { bpm: 120, offset: 0, beats: [2, 2.5, 3], confidence: 1 }
  const world = new GameWorld(map, 5, 'Easy')
  const target = world.targets[0]
  world.update(2.23)
  assert.equal(world.stats.counts.Miss, 1)
  const result = world.hit(target.x, target.y, 2.08, 800, 500, 42)
  assert.equal(result.grade, 'Close')
  assert.equal(result.errorMs, 80)
  assert.equal(world.stats.counts.Miss, 0)
  assert.equal(world.stats.counts.Close, 1)
})

test('automatic misses resolve once and finishing accounts for all remaining targets', () => {
  const map = { bpm: 120, offset: 0, beats: [2, 2.5, 3], confidence: 1 }
  const world = new GameWorld(map, 5, 'Easy')
  world.update(2.22)
  world.update(2.25)
  assert.equal(world.stats.counts.Miss, 1)
  world.finish(5)
  assert.equal(world.stats.counts.Miss, 3)
  world.finish(5)
  assert.equal(world.stats.counts.Miss, 3)
})

test('offline charts align to percussive attacks and suppress silent sections', () => {
  const { samples, sampleRate } = pulseTrain(120)
  samples.fill(0, 10000, 20000)
  const chart = buildSongChart(samples, sampleRate, 120)
  assert.ok(chart.notes.length > 20)
  assert.ok(!chart.notes.some(time => time > 10.5 && time < 19.5))
  assert.ok(chart.notes.filter(time => time < 9).every(time => nearestBeatDistance(time, { bpm: 120, offset: 0.12, beats: [], confidence: 1 }) < 0.04))
})

test('all 24 recordings have usable stored charts and each new genre has three tracks', () => {
  const tracks = require('../lib/music/tracks.json')
  assert.equal(tracks.length, 24)
  for (const genre of ['Rock', 'Jazz', 'Punk', 'Metal']) assert.equal(tracks.filter(track => track.genre === genre).length, 3)
  for (const track of tracks) {
    const chart = JSON.parse(fs.readFileSync(`${__dirname}/../public/charts/${track.id}.json`, 'utf8'))
    assert.equal(chart.version, 3)
    assert.ok(chart.notes.length > 10, track.id)
    assert.ok(chart.beats.every((time, index) => time >= 0 && time < chart.duration && (!index || time > chart.beats[index - 1])), track.id)
    assert.ok(Math.abs(chart.duration - track.duration) < 1)
    assert.ok(chart.notes.every(time => chart.beats.includes(time)), track.id)
    assert.ok(chart.beats.slice(1).every((time, index) => Math.abs(time - chart.beats[index] - 60 / chart.bpm) < 1e-7), track.id)
    assert.ok(fs.statSync(`${__dirname}/../public/music/${track.id}.mp3`).size > 1000)
  }
})

class FakeAudioContext {
  currentTime = 0
  sampleRate = 1000
  destination = {}
  static instance
  clicks = []
  constructor() { FakeAudioContext.instance = this }
  async resume() {}
  async close() {}
  createAnalyser() { return { fftSize: 2048, connect() {}, getByteFrequencyData(array) { array.fill(0) } } }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
  createOscillator() {
    const context = this
    return { frequency: { value: 0 }, connect() {}, disconnect() {}, start(at) { context.clicks.push(at) }, stop() {} }
  }
  createBufferSource() { return { buffer: null, onended: null, connect() {}, disconnect() {}, start() {}, stop() {} } }
  async decodeAudioData() { return { duration: 30, length: 30000, numberOfChannels: 1, sampleRate: 1000, getChannelData: () => pulseTrain(120).samples } }
}

test('pause/resume uses the audio clock and restart rewinds rather than duplicating playback', async () => {
  global.AudioContext = FakeAudioContext
  const audio = new AudioProcessor()
  await audio.loadAudio(new ArrayBuffer(8), 120)
  await audio.startPlayback()
  const context = FakeAudioContext.instance
  context.currentTime = 5
  assert.equal(audio.currentTime, 5)
  audio.stopPlayback()
  context.currentTime = 10
  assert.equal(audio.currentTime, 5)
  await audio.startPlayback()
  context.currentTime = 13
  assert.equal(audio.currentTime, 8)
  audio.rewind()
  assert.equal(audio.currentTime, 0)
  await audio.startPlayback()
  context.currentTime = 50
  assert.equal(audio.currentTime, 30)
  assert.equal(audio.ended, true)
  audio.dispose()
})

test('pausing while an audio resume is pending cannot start a stray source', async () => {
  global.AudioContext = FakeAudioContext
  const audio = new AudioProcessor()
  await audio.loadAudio(new ArrayBuffer(8), 120)
  const starting = audio.startPlayback()
  audio.stopPlayback()
  await starting
  FakeAudioContext.instance.currentTime = 5
  assert.equal(audio.currentTime, 0)
  audio.dispose()
})

test('input timestamps use audible output time instead of the render-frame clock', async () => {
  global.AudioContext = FakeAudioContext
  const audio = new AudioProcessor()
  await audio.loadAudio(new ArrayBuffer(8), 120)
  await audio.startPlayback()
  const context = FakeAudioContext.instance
  context.currentTime = 10
  context.getOutputTimestamp = () => ({ contextTime: 9.8, performanceTime: 5000 })
  assert.ok(Math.abs(audio.timeAt(5010) - 9.81) < 1e-8)
  assert.equal(audio.currentTime, 10)
  audio.stopPlayback()
  context.currentTime = 20
  assert.equal(audio.timeAt(20000), 10)
  audio.dispose()
})

test('valid stored charts preserve edited timestamps; incompatible charts are regenerated', async () => {
  global.AudioContext = FakeAudioContext
  const audio = new AudioProcessor()
  const edited = { version: 3, bpm: 120, offset: 0.1, confidence: 1, duration: 30, beats: [1.123, 1.64, 2.11], notes: [1.64, 2.11] }
  await audio.loadAudio(new ArrayBuffer(8), 120, edited)
  assert.deepEqual(audio.beatMap.notes, edited.notes)
  await audio.loadAudio(new ArrayBuffer(8), 120, { ...edited, duration: 50 })
  assert.ok(audio.beatMap.beats.length > 3)
  assert.notDeepEqual(audio.beatMap.notes, edited.notes)
  audio.dispose()
})

test('decoder end-padding differences trim chart tails without regenerating beat phase', async () => {
  global.AudioContext = FakeAudioContext
  const audio = new AudioProcessor()
  const stored = { version: 3, bpm: 120, offset: 0.123, confidence: 1, duration: 30.08,
    beats: [0.123, 0.623, 1.123, 29.9, 30.04], notes: [1.123, 29.9, 30.04] }
  await audio.loadAudio(new ArrayBuffer(8), 120, stored)
  assert.equal(audio.beatMap.offset, 0.123)
  assert.equal(audio.beatMap.duration, 30)
  assert.deepEqual(audio.beatMap.beats, [0.123, 0.623, 1.123, 29.9])
  assert.deepEqual(audio.beatMap.notes, [1.123, 29.9])
  assert.deepEqual(stored.notes, [1.123, 29.9, 30.04])
  audio.dispose()
})

test('fractional pulse fitting stays aligned through a three-minute recording', () => {
  const { samples, sampleRate } = pulseTrain(131.26, 0.12, 180)
  const map = analyzeBeats(samples, sampleRate)
  assert.ok(Math.abs(map.bpm - 131.26) < 0.05, `inferred ${map.bpm}`)
  for (const beat of [8, 180, 370]) {
    const expected = 0.12 + beat * 60 / 131.26
    assert.ok(nearestBeatDistance(expected, map) < 0.025, `drift at ${expected}`)
  }
})

test('counter is phase-aligned, counts subdivisions, and supports an explicit tempo change', () => {
  const map = { bpm: 120, offset: 0.1, beats: makeBeatGrid(10, 120, 0.1), beatsPerBar: 4, confidence: 1 }
  assert.equal(beatPosition(0.09, map, 2).total, 0)
  assert.equal(beatPosition(0.1, map, 2).beat, 1)
  const eighth = beatPosition(1.35, map, 2)
  assert.equal(eighth.total, 3)
  assert.equal(eighth.beat, 3)
  assert.equal(eighth.subdivision, 1)
  assert.equal(beatPosition(2.1, map, 4).bar, 2)
  const tempoMap = [{ startTime: 0.1, bpm: 120 }, { startTime: 2.1, bpm: 60 }]
  const changed = { ...map, tempoMap, beats: makeTempoGrid(6, tempoMap) }
  assert.equal(beatPosition(2.85, changed, 4).subdivision, 3)
  assert.equal(beatPosition(3.1, changed, 4).total, 6)
  assert.equal(beatPosition(5.35, changed, 4).subdivision, 1)
})

test('level two progresses from alternating eighths to full paradiddles; level three doubles density', () => {
  const map = { bpm: 120, offset: 0, beats: makeBeatGrid(20, 120, 0), confidence: 1, beatsPerBar: 4 }
  const normal = createTargets(map, 20, 'Normal')
  const hard = createTargets(map, 20, 'Hard')
  assert.deepEqual(normal.slice(0, 8).map(target => target.hand), ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'])
  assert.equal(normal[15].pattern, 'Alternating')
  assert.equal(normal[16].pattern, 'Paradiddle')
  assert.deepEqual(normal.slice(16, 24).map(target => target.hand), paradiddle)
  assert.deepEqual(hard.slice(32, 40).map(target => target.hand), paradiddle)
  assert.equal(normal[17].time - normal[16].time, 0.25)
  assert.equal(hard[33].time - hard[32].time, 0.125)
  assert.equal(normal[18].x, normal[19].x) // R R double shares a pad.
  assert.ok(hard.every(target => target.window <= 0.0625 + 1e-7))
})

test('paradiddle sticking continues across a three-beat measure boundary', () => {
  const map = { bpm: 120, offset: 0, beats: makeBeatGrid(20, 120, 0), confidence: 1, beatsPerBar: 3 }
  const targets = createTargets(map, 20, 'Normal').filter(target => target.pattern === 'Paradiddle')
  assert.deepEqual(targets.slice(0, 16).map(target => target.hand), [...paradiddle, ...paradiddle])
})

test('wrong stick preserves timing feedback, consumes only the due note, and separates accuracy', () => {
  const map = { bpm: 120, offset: 0, beats: makeBeatGrid(20, 120, 0), confidence: 1 }
  const world = new GameWorld(map, 20, 'Normal')
  const target = world.targets[0]
  assert.equal(target.hand, 'R')
  const wrong = world.strike('L', target.time + 0.01)
  assert.equal(wrong.grade, 'Wrong stick')
  assert.equal(wrong.timing, 'Perfect')
  assert.equal(wrong.expectedHand, 'R')
  assert.equal(world.targets[1].resolved, false)
  assert.equal(world.stats.timingAccuracy, 100)
  assert.equal(world.stats.stickAccuracy, 0)
  assert.equal(world.stats.score, 0)
  assert.equal(world.strike('L', world.targets[1].time).grade, 'Perfect')
  assert.equal(world.stats.stickAccuracy, 50)
})

test('dense hits cannot steal the next stroke while held doubles still require separate strikes', () => {
  const map = { bpm: 180, offset: 0, beats: makeBeatGrid(20, 180, 0), confidence: 1 }
  const world = new GameWorld(map, 20, 'Hard')
  const target = world.targets[0], next = world.targets[1]
  assert.ok(target.time + target.window <= next.time - next.window + 1e-7)
  assert.equal(world.strike(target.hand, target.time).grade, 'Perfect')
  assert.equal(world.strike(next.hand, target.time + 0.001).grade, 'Too early')
  assert.equal(next.resolved, false)
  assert.equal(world.strike(next.hand, next.time).grade, 'Perfect')
})

test('left and right physical Control keys remain distinct', () => {
  assert.equal(controlStick('ControlLeft', 1), 'L')
  assert.equal(controlStick('ControlRight', 2), 'R')
  assert.equal(controlStick('Control', 2), 'R')
  assert.equal(controlStick('KeyA', 0), null)
})

test('count-in lands on chart phase and metronome scheduling does not duplicate beats', async () => {
  global.AudioContext = FakeAudioContext
  const audio = new AudioProcessor()
  await audio.loadAudio(new ArrayBuffer(8), 120)
  audio.beatMap = { bpm: 120, offset: 0.2, beats: makeBeatGrid(30, 120, 0.2), confidence: 1 }
  audio.setMetronome(true)
  await audio.startPlayback(1.88, true)
  const context = FakeAudioContext.instance
  assert.equal(context.clicks.length, 4)
  assert.ok(Math.abs(context.clicks[0] - 0.08) < 1e-8)
  assert.ok(Math.abs(context.clicks[3] + 0.5 - 2.08) < 1e-8)
  context.currentTime = 1.98
  audio.update(); audio.update()
  assert.equal(context.clicks.length, 5)
  assert.ok(Math.abs(context.clicks[4] - 2.08) < 1e-8)
  audio.dispose()
})
