const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

// Run source directly without a second build tree or additional test dependency.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
}
const { analyzeBeats, makeBeatGrid, nearestBeatDistance, timingGrade } = require('../lib/game-engine/rhythm.ts')
const { createEncounters } = require('../lib/game-engine/gameWorld.ts')
const { Player } = require('../lib/game-engine/player.ts')
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
  assert.equal(timingGrade(-0.08), 'Perfect')
  assert.equal(timingGrade(0.19), 'Good')
  assert.equal(timingGrade(-0.3), 'Collected')
  const map = { bpm: 120, offset: 0.1, beats: [], confidence: 1 }
  assert.ok(Math.abs(nearestBeatDistance(1.09, map) - 0.01) < 1e-8)
  assert.ok(Math.abs(nearestBeatDistance(1.11, map) - 0.01) < 1e-8)
  const expressive = { ...map, beats: [0.1, 0.62, 1.09, 1.61] }
  assert.equal(nearestBeatDistance(1.09, expressive), 0)
  assert.ok(Math.abs(nearestBeatDistance(1.11, expressive) - 0.02) < 1e-8)
})

test('encounters are deterministic, previewable, and hazards leave note lanes clear', () => {
  const map = { bpm: 120, offset: 0.1, beats: makeBeatGrid(60, 120, 0.1), confidence: 1 }
  const easy = createEncounters(map, 60, 'Easy')
  const hard = createEncounters(map, 60, 'Hard')
  assert.deepEqual(hard, createEncounters(map, 60, 'Hard'))
  assert.ok(hard.filter(e => e.kind === 'note').length > easy.filter(e => e.kind === 'note').length)
  assert.ok(hard.every(e => e.time >= 3 && e.time <= 59 && e.y > 0.2 && e.y < 0.8))
  for (const hazard of hard.filter(e => e.kind === 'hazard')) {
    const note = hard.find(e => e.kind === 'note' && e.time === hazard.time)
    assert.ok(Math.abs(note.y - hazard.y) > 0.1)
  }
})

test('matched timing builds resonance, mismatches do not, and damage has a grace period', () => {
  const player = new Player()
  for (let i = 0; i < 16; i++) player.collect('Perfect', true, i)
  assert.equal(player.combo, 16)
  assert.equal(player.multiplier, 3)
  assert.equal(player.burstUntil, 19)
  assert.equal(player.damage(16), false)
  player.collect('Perfect', false, 20)
  assert.equal(player.combo, 15)
  assert.equal(player.damage(21), true)
  assert.equal(player.damage(21.1), false)
  assert.equal(player.combo, 0)
  assert.equal(player.health, 84)
})

test('movement is independent of frame rate and cannot overshoot', () => {
  const a = new Player(), b = new Player()
  a.targetX = b.targetX = 0.8
  for (let i = 0; i < 30; i++) a.move(1 / 30, 1000, 600)
  for (let i = 0; i < 120; i++) b.move(1 / 120, 1000, 600)
  assert.ok(Math.abs(a.x - b.x) < 0.001)
  assert.ok(a.x <= 0.8)
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
