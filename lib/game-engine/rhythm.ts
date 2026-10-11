export interface BeatMap {
  bpm: number
  offset: number
  confidence: number
  beats: number[]
  notes?: number[]
  version?: number
  duration?: number
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
  const rate = sampleRate / hop
  let bpm = suppliedBpm || 120
  let confidence = 0
  if (!suppliedBpm) {
    let best = 0
    let sum = 0
    let count = 0
    // Limit the search window to keep long uploads responsive.
    const length = Math.min(envelope.length, Math.floor(rate * 90))
    for (let candidate = 70; candidate <= 180; candidate++) {
      const lag = Math.round(rate * 60 / candidate)
      let correlation = 0
      for (let i = lag; i < length; i++) correlation += envelope[i] * envelope[i - lag]
      sum += correlation
      count++
      if (correlation > best) { best = correlation; bpm = candidate }
    }
    confidence = best > 0 ? Math.min(1, Math.max(0, (best / (sum / count) - 1) / 3)) : 0
  }
  // Very fast songs use half-time encounters; visuals still follow this shared clock.
  if (bpm > 180) bpm /= 2
  const period = 60 / bpm
  let phase = 0
  let bestPhase = 0
  let total = 0
  const phaseScores = new Float64Array(100)
  for (let i = 0; i < envelope.length; i++) {
    const bin = Math.round(((i / rate) % period) / period * 100) % 100
    phaseScores[bin] += envelope[i]
    total += envelope[i]
  }
  for (let bin = 0; bin < 100; bin++) {
    let score = 0
    for (let neighbor = -3; neighbor <= 3; neighbor++) score += phaseScores[(bin + neighbor + 100) % 100]
    if (score > bestPhase) { bestPhase = score; phase = bin / 100 * period }
  }
  if (suppliedBpm) confidence = total > 0 ? Math.min(1, bestPhase / total * 4) : 0
  const beats = makeBeatGrid(samples.length / sampleRate, bpm, phase).map(expected => {
    // Keep the regular tempo as an anchor, but align each beat to a nearby
    // attack. This handles small expressive timing differences without drift.
    const start = Math.max(0, Math.floor((expected - 0.06) * rate))
    const end = Math.min(envelope.length - 1, Math.ceil((expected + 0.06) * rate))
    let peak = 0
    let aligned = expected
    for (let i = start; i <= end; i++) {
      if (envelope[i] > peak) { peak = envelope[i]; aligned = i / rate }
    }
    return aligned
  })
  return { bpm, offset: phase, confidence, beats }
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

export type Judgment = 'Perfect' | 'Close' | 'Early' | 'Late' | 'Too early' | 'Miss' | 'No target'
export const hitWindow = 0.18

export function timingGrade(errorSeconds: number): Judgment {
  const error = Math.round(Math.abs(errorSeconds) * 1000000) / 1000000
  if (errorSeconds < -hitWindow && error > hitWindow) return 'Too early'
  if (error > hitWindow) return 'Miss'
  if (error <= 0.045) return 'Perfect'
  if (error <= 0.1) return 'Close'
  return errorSeconds < 0 ? 'Early' : 'Late'
}

export function describeTiming(grade: Judgment, errorMs: number | null): string {
  if (errorMs === null || grade === 'Miss' || grade === 'No target') return grade
  const amount = Math.round(Math.abs(errorMs))
  return `${grade} · ${amount === 0 ? 'on time' : `${amount} ms ${errorMs < 0 ? 'early' : 'late'}`}`
}

// Offline charts follow locally detected attacks, with a tempo anchor that can
// adapt gradually. Quiet passages are excluded from target generation.
export function buildSongChart(samples: Float32Array, sampleRate: number, suppliedBpm?: number): BeatMap {
  const map = analyzeBeats(samples, sampleRate, suppliedBpm)
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
  const period = 60 / map.bpm
  const beats: number[] = []
  const notes: number[] = []
  let correction = 0
  for (let expected = map.offset; expected < samples.length / sampleRate; expected += period) {
    const predicted = expected + correction
    const radius = Math.min(0.12, period * 0.24)
    const start = Math.max(0, Math.floor((predicted - radius) * rate))
    const end = Math.min(attacks.length - 1, Math.ceil((predicted + radius) * rate))
    let bestScore = 0, strongest = 0, aligned = predicted
    for (let i = start; i <= end; i++) {
      const weighted = attacks[i] * (1 - Math.abs(i / rate - predicted) / (radius * 2))
      if (weighted > bestScore) { bestScore = weighted; strongest = attacks[i]; aligned = i / rate }
    }
    correction += (aligned - predicted) * 0.35
    if (aligned < 0 || aligned >= samples.length / sampleRate) continue
    const time = Math.round(aligned * 1000) / 1000
    if (beats.length && time - beats[beats.length - 1] < period * 0.5) continue
    beats.push(time)
    const localEnergy = energy[Math.min(energy.length - 1, Math.round(aligned * rate))] || 0
    if (strongest > attackThreshold && localEnergy > maxEnergy * 0.045) notes.push(time)
  }
  return { ...map, beats, notes, version: 2, duration: samples.length / sampleRate }
}
