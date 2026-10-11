export interface BeatMap {
  bpm: number
  offset: number
  confidence: number
  beats: number[]
  notes?: number[]
  version?: number
  duration?: number
  beatsPerBar?: number
  meterVerified?: boolean
  tempoMap?: { startTime: number; bpm: number }[]
  attacks?: number[]
  alignment?: { section: string; meanResidualMs: number; matchedBeats: number }[]
}

export const subdivisionsFor = (difficulty: string) => difficulty === 'Triplet' ? 3 : difficulty === 'Hard' || difficulty === 'Sixteenth' ? 4 : difficulty === 'Normal' ? 2 : 1
export const subdivisionLabels = (division: number) => division === 4 ? ['', 'e', '&', 'a'] : division === 3 ? ['', 'trip', 'let'] : division === 2 ? ['', '&'] : ['']
export const beatAccent = (beat: number) => beat === 1 ? 1 : beat === 3 ? 0.55 : beat > 0 ? 0.22 : 0
export type Stick = 'L' | 'R'
export const paradiddle: Stick[] = ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L']
export const controlStick = (code: string, location: number): Stick | null =>
  code === 'ControlLeft' || (code === 'Control' && location === 1) ? 'L' : code === 'ControlRight' || (code === 'Control' && location === 2) ? 'R' : null

export function makeTempoGrid(duration: number, segments: { startTime: number; bpm: number }[]) {
  const beats: number[] = []
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    const end = Math.min(duration, segments[index + 1]?.startTime ?? duration)
    for (let time = segment.startTime; time < end - 1e-7; time += 60 / segment.bpm) beats.push(time)
  }
  return beats
}

export function beatInterval(map: BeatMap, index: number) {
  if (map.beats[index + 1] !== undefined) return map.beats[index + 1] - map.beats[index]
  const segment = map.tempoMap?.filter(item => item.startTime <= map.beats[index]).pop()
  return 60 / (segment?.bpm || map.bpm)
}

export function beatPosition(time: number, map: BeatMap, division = 1) {
  const beats = map.beats
  let low = 0, high = beats.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (beats[middle] <= time + 1e-7) low = middle + 1
    else high = middle
  }
  const index = low - 1
  const meter = map.beatsPerBar || 4
  if (index < 0) return { total: 0, beat: 0, bar: 0, subdivision: 0, phase: 0 }
  const period = beatInterval(map, index)
  const phase = Math.max(0, Math.min(0.999999, (time - beats[index]) / period))
  return { total: index + 1, beat: index % meter + 1, bar: Math.floor(index / meter) + 1, subdivision: Math.min(division - 1, Math.floor(phase * division + 1e-7)), phase }
}

// Autocorrelation identifies the pulse family. Whole-recording phase coherence
// then fits fractional BPM: integer BPM/rounded lags can drift over a long song.
function fitPulse(envelope: number[], rate: number, suppliedBpm?: number) {
  let bpm = suppliedBpm || 120
  let correlationConfidence = 1
  if (!suppliedBpm) {
    let best = 0, sum = 0, count = 0
    const length = Math.min(envelope.length, Math.floor(rate * 90))
    for (let candidate = 70; candidate <= 180; candidate++) {
      const lag = Math.round(rate * 60 / candidate)
      let correlation = 0
      for (let i = lag; i < length; i++) correlation += envelope[i] * envelope[i - lag]
      sum += correlation; count++
      if (correlation > best) { best = correlation; bpm = candidate }
    }
    correlationConfidence = best ? Math.min(1, Math.max(0, (best / (sum / count) - 1) / 3)) : 0
  }
  if (bpm > 180) bpm /= 2
  const measure = (candidate: number) => {
    const period = 60 / candidate
    const bins = new Float64Array(100)
    let total = 0
    for (let i = 0; i < envelope.length; i++) {
      const value = envelope[i]
      if (!value) continue
      bins[Math.round(((i / rate) % period) / period * 100) % 100] += value
      total += value
    }
    let best = 0, phase = 0
    for (let bin = 0; bin < 100; bin++) {
      let score = 0
      for (let neighbor = -2; neighbor <= 2; neighbor++) score += bins[(bin + neighbor + 100) % 100]
      if (score > best) { best = score; phase = bin / 100 * period }
    }
    return { score: total ? best / total : 0, phase }
  }
  let fit = measure(bpm)
  if (!suppliedBpm && correlationConfidence > 0) {
    const anchor = bpm
    for (let candidate = Math.max(60, anchor - 3); candidate <= Math.min(183, anchor + 3); candidate += 0.02) {
      const next = measure(candidate)
      if (next.score > fit.score) { fit = next; bpm = Math.round(candidate * 100) / 100 }
    }
  }
  return { bpm, offset: fit.phase, confidence: Math.min(correlationConfidence, Math.min(1, fit.score * 4)) }
}

export function makeBeatGrid(duration: number, bpm: number, offset: number): number[] {
  const interval = 60 / bpm
  const beats: number[] = []
  for (let time = Math.max(0, offset); time < duration; time += interval) beats.push(time)
  return beats
}

// Analyze a short-time energy envelope. Positive energy changes emphasize attacks
// rather than sustained loud notes; bundled BPM comes from the composer's catalog.
export function analyzeBeats(samples: Float32Array, sampleRate: number, suppliedBpm?: number): BeatMap {
  const hop = Math.max(1, Math.round(sampleRate / 100))
  const envelope: number[] = []
  let previous = 0
  for (let i = 0; i < samples.length; i += hop) {
    let energy = 0
    const end = Math.min(samples.length, i + hop)
    for (let j = i; j < end; j++) energy += samples[j] * samples[j]
    const rms = Math.sqrt(energy / (end - i))
    envelope.push(Math.max(0, rms - previous))
    previous = rms
  }
  const fit = fitPulse(envelope, sampleRate / hop, suppliedBpm)
  return { ...fit, beats: makeBeatGrid(samples.length / sampleRate, fit.bpm, fit.offset) }
}

export function nearestBeatDistance(time: number, map: BeatMap): number {
  if (map.beats.length) {
    let low = 0
    let high = map.beats.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (map.beats[middle] < time) low = middle + 1
      else high = middle
    }
    return Math.min(
      low > 0 ? Math.abs(time - map.beats[low - 1]) : Infinity,
      low < map.beats.length ? Math.abs(time - map.beats[low]) : Infinity
    )
  }
  const period = 60 / map.bpm
  const phase = ((time - map.offset) % period + period) % period
  return Math.min(phase, period - phase)
}

export type Judgment = 'Perfect' | 'Close' | 'Early' | 'Late' | 'Too early' | 'Miss' | 'No target' | 'Wrong stick'
const originalHitWindow = 0.18
const timingLeniency = 1.2
export const hitWindow = originalHitWindow * timingLeniency

// `window` has already been capped by adjacent-note spacing. Scale the old
// grading bands by 20%, then keep them inside that safe acceptance window.
export function timingWindows(window = hitWindow) {
  const originalWindow = Math.min(originalHitWindow, window)
  return {
    hit: window,
    perfect: Math.min(window, Math.min(0.045, originalWindow * 0.5) * timingLeniency),
    close: Math.min(window, Math.min(0.1, originalWindow * 0.85) * timingLeniency)
  }
}

export function timingGrade(errorSeconds: number, window = hitWindow): Judgment {
  const error = Math.abs(errorSeconds)
  const bands = timingWindows(window)
  if (errorSeconds < -window && error > window + 1e-7) return 'Too early'
  if (error > window + 1e-7) return 'Miss'
  if (error <= bands.perfect + 1e-7) return 'Perfect'
  if (error <= bands.close + 1e-7) return 'Close'
  return errorSeconds < 0 ? 'Early' : 'Late'
}

export function describeTiming(grade: Judgment, errorMs: number | null): string {
  if (errorMs === null || grade === 'Miss' || grade === 'No target') return grade
  const amount = Math.round(Math.abs(errorMs))
  return `${grade} · ${amount === 0 ? 'on time' : `${amount} ms ${errorMs < 0 ? 'early' : 'late'}`}`
}

// Attacks diagnose phase and active passages; they NEVER move individual beats.
// This distinction is essential for consistent subdivisions and rudiments.
export function buildSongChart(samples: Float32Array, sampleRate: number, suppliedBpm?: number,
  options: { offset?: number; beatsPerBar?: number; meterVerified?: boolean; tempoMap?: { startTime: number; bpm: number }[] } = {}): BeatMap {
  const hop = Math.max(1, Math.round(sampleRate / 100))
  const rate = sampleRate / hop
  const energy: number[] = []
  const attacks: number[] = []
  let low = 0
  let previousBass = 0
  let previousHigh = 0
  const coefficient = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate)
  for (let start = 0; start < samples.length; start += hop) {
    let bass = 0, high = 0, total = 0
    const end = Math.min(samples.length, start + hop)
    for (let i = start; i < end; i++) {
      low += coefficient * (samples[i] - low)
      bass += low * low
      high += (samples[i] - low) ** 2
      total += samples[i] ** 2
    }
    const length = end - start
    const bassLevel = Math.sqrt(bass / length)
    const highLevel = Math.sqrt(high / length)
    energy.push(Math.sqrt(total / length))
    attacks.push(Math.max(0, bassLevel - previousBass) * 1.5 + Math.max(0, highLevel - previousHigh))
    previousBass = bassLevel
    previousHigh = highLevel
  }
  const maxEnergy = energy.reduce((max, value) => Math.max(max, value), 0)
  const sorted = attacks.filter(value => value > 0).sort((a, b) => a - b)
  const attackThreshold = (sorted[Math.floor(sorted.length * 0.7)] || 0) * 0.15
  const map = fitPulse(attacks, rate, suppliedBpm)
  if (Number.isFinite(options.offset)) map.offset = Math.max(0, options.offset!)
  const segments = options.tempoMap?.length ? options.tempoMap : [{ startTime: map.offset, bpm: map.bpm }]
  if (segments.some((segment, index) => !Number.isFinite(segment.startTime) || !Number.isFinite(segment.bpm) || segment.startTime < 0 || segment.bpm <= 0 || (index > 0 && segment.startTime <= segments[index - 1].startTime))) throw new Error('Invalid tempo map')
  map.offset = segments[0].startTime
  map.bpm = segments[0].bpm
  const beats = makeTempoGrid(samples.length / sampleRate, segments)
  const notes: number[] = []
  const detected: number[] = []
  const residuals: { time: number; error: number }[] = []
  for (let beat = 0; beat < beats.length; beat++) {
    const expected = beats[beat]
    const period = beat + 1 < beats.length ? beats[beat + 1] - expected : 60 / segments[segments.length - 1].bpm
    const radius = Math.min(0.12, period * 0.24)
    const start = Math.max(0, Math.floor((expected - radius) * rate))
    const end = Math.min(attacks.length - 1, Math.ceil((expected + radius) * rate))
    let bestScore = 0, strongest = 0, aligned = expected
    for (let i = start; i <= end; i++) {
      const weighted = attacks[i] * (1 - Math.abs(i / rate - expected) / (radius * 2))
      if (weighted > bestScore) { bestScore = weighted; strongest = attacks[i]; aligned = i / rate }
    }
    const localEnergy = energy[Math.min(energy.length - 1, Math.round(aligned * rate))] || 0
    if (strongest > attackThreshold && localEnergy > maxEnergy * 0.045) {
      notes.push(expected)
      detected.push(Math.round(aligned * 1000) / 1000)
      residuals.push({ time: expected, error: (aligned - expected) * 1000 })
    }
  }
  const duration = samples.length / sampleRate
  const alignment = ['Beginning', 'Middle', 'End'].map((section, index) => {
    const matched = residuals.filter(hit => hit.time >= index * duration / 3 && hit.time < (index + 1) * duration / 3)
    return { section, matchedBeats: matched.length, meanResidualMs: matched.length ? Math.round(matched.reduce((sum, hit) => sum + hit.error, 0) / matched.length) : 0 }
  })
  return { ...map, beats, notes, attacks: detected, alignment, beatsPerBar: options.beatsPerBar || 4,
    meterVerified: options.meterVerified || false, version: 3, duration, tempoMap: segments }
}
