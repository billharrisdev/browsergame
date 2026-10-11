const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

// Run source directly without a second build tree or additional test dependency.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
}
const { analyzeBeats, buildSongChart, makeBeatGrid, nearestBeatDistance, timingGrade, describeTiming } = require('../lib/game-engine/rhythm.ts')
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
  assert.equal(timingGrade(-0.045), 'Perfect')
  assert.equal(timingGrade(0.045), 'Perfect')
  assert.equal(timingGrade(-0.1), 'Close')
  assert.equal(timingGrade(0.1), 'Close')
  assert.equal(timingGrade(-0.18), 'Early')
  assert.equal(timingGrade(0.18), 'Late')
  assert.equal(timingGrade(-0.181), 'Too early')
  assert.equal(timingGrade(0.181), 'Miss')
  assert.equal(describeTiming('Close', -75), 'Close · 75 ms early')
  assert.equal(describeTiming('Perfect', 0), 'Perfect · on time')
  const map = { bpm: 120, offset: 0.1, beats: [], confidence: 1 }
  assert.ok(Math.abs(nearestBeatDistance(1.09, map) - 0.01) < 1e-8)
  assert.ok(Math.abs(nearestBeatDistance(1.11, map) - 0.01) < 1e-8)
  const expressive = { ...map, beats: [0.1, 0.62, 1.09, 1.61] }
  assert.equal(nearestBeatDistance(1.09, expressive), 0)
  assert.ok(Math.abs(nearestBeatDistance(1.11, expressive) - 0.02) < 1e-8)
})

test('targets are deterministic, difficulty changes density, and timing stays on the chart', () => {
  const map = { bpm: 120, offset: 0.1, beats: makeBeatGrid(60, 120, 0.1), confidence: 1 }
  const easy = createTargets(map, 60, 'Easy')
  const hard = createTargets(map, 60, 'Hard')
  assert.deepEqual(hard, createTargets(map, 60, 'Hard'))
  assert.ok(hard.length > easy.length)
  assert.ok(hard.every(e => e.time >= 1.5 && e.time < 59.6 && e.y > 0.2 && e.y < 0.8 && map.beats.includes(e.time)))
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
  const world = new GameWorld(map, 5, 'Normal')
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
  const world = new GameWorld(map, 5, 'Normal')
  const target = world.targets[0]
  world.update(2.21)
  assert.equal(world.stats.counts.Miss, 1)
  const result = world.hit(target.x, target.y, 2.08, 800, 500, 42)
  assert.equal(result.grade, 'Close')
  assert.equal(result.errorMs, 80)
  assert.equal(world.stats.counts.Miss, 0)
  assert.equal(world.stats.counts.Close, 1)
})

test('automatic misses resolve once and finishing accounts for all remaining targets', () => {
  const map = { bpm: 120, offset: 0, beats: [2, 2.5, 3], confidence: 1 }
  const world = new GameWorld(map, 5, 'Normal')
  world.update(2.2)
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
    assert.equal(chart.version, 2)
    assert.ok(chart.notes.length > 10, track.id)
    assert.ok(chart.beats.every((time, index) => time >= 0 && time < chart.duration && (!index || time > chart.beats[index - 1])), track.id)
    assert.ok(Math.abs(chart.duration - track.duration) < 1)
    assert.ok(fs.statSync(`${__dirname}/../public/music/${track.id}.mp3`).size > 1000)
  }
})

class FakeAudioContext {
  currentTime = 0
  sampleRate = 1000
  destination = {}
  static instance
  constructor() { FakeAudioContext.instance = this }
  async resume() {}
  async close() {}
  createAnalyser() { return { fftSize: 2048, connect() {}, getByteFrequencyData(array) { array.fill(0) } } }
  createGain() { return { gain: { value: 0, setTargetAtTime() {} }, connect() {} } }
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
  const edited = { version: 2, bpm: 120, offset: 0.1, confidence: 1, duration: 30, beats: [1.123, 1.64, 2.11], notes: [1.64, 2.11] }
  await audio.loadAudio(new ArrayBuffer(8), 120, edited)
  assert.deepEqual(audio.beatMap.notes, edited.notes)
  await audio.loadAudio(new ArrayBuffer(8), 120, { ...edited, duration: 50 })
  assert.ok(audio.beatMap.beats.length > 3)
  assert.notDeepEqual(audio.beatMap.notes, edited.notes)
  audio.dispose()
})
