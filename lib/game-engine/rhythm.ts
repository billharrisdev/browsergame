export interface BeatMap {
  bpm: number
  offset: number
  confidence: number
  beats: number[]
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

export function timingGrade(errorSeconds: number): 'Perfect' | 'Good' | 'Collected' {
  const error = Math.abs(errorSeconds)
  return error <= 0.09 ? 'Perfect' : error <= 0.2 ? 'Good' : 'Collected'
}
