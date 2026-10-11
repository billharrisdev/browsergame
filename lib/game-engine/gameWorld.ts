import { beatInterval, BeatMap, describeTiming, hitWindow, Judgment, paradiddle, Stick, subdivisionsFor, timingGrade } from './rhythm'
import { RunScore } from './scoring'

export interface BeatTarget {
  id: number; time: number; x: number; y: number; resolved: boolean
  hand: Stick | null; pattern: 'Pulse' | 'Alternating' | 'Paradiddle' | 'Free' | 'Swing'; step: number; window: number
  timedOut?: boolean; comboBeforeMiss?: number
}
export interface HitResult {
  grade: Judgment; timing?: Judgment; errorMs: number | null; x: number; y: number; time: number; targetId?: number
  expectedHand?: Stick | null; actualHand?: Stick | null
}
export const approachTime = (difficulty: string) => difficulty === 'Easy' ? 1.2 : difficulty === 'Triplet' || difficulty === 'Swing' ? 0.9 : difficulty === 'Hard' || difficulty === 'Sixteenth' ? 0.75 : 1
export function describeHit(hit: HitResult) {
  const timing = describeTiming(hit.timing || hit.grade, hit.errorMs)
  if (hit.grade === 'Wrong stick') return `${timing} · Wrong stick: expected ${hit.expectedHand}, used ${hit.actualHand || 'no stick'}`
  return hit.expectedHand && hit.actualHand && !['Too early', 'Miss'].includes(hit.grade) ? `${timing} · Correct ${hit.actualHand} stick` : timing
}

export function createTargets(map: BeatMap, duration: number, difficulty: string): BeatTarget[] {
  const division = subdivisionsFor(difficulty)
  const freeForm = difficulty === 'Easy' || difficulty === 'Triplet' || difficulty === 'Swing'
  const meter = map.beatsPerBar || 4
  const active = new Set((map.notes || map.beats).map(time => Math.round(time * 1000000)))
  const route = [[0.2, 0.27], [0.5, 0.22], [0.8, 0.34], [0.77, 0.72], [0.47, 0.77], [0.2, 0.67]]
  const firstBeat = map.beats.findIndex((time, index) => time >= 1.5 && index % meter === 0)
  if (firstBeat < 0) return []
  const targets: BeatTarget[] = []
  const introSlots = 2 * meter * division
  for (let beat = firstBeat; beat < map.beats.length; beat++) {
    const barStart = Math.floor(beat / meter) * meter
    // Keep rudiments complete within active practice measures instead of
    // dropping individual strokes when the recording has no transient there.
    if (!map.beats.slice(barStart, barStart + meter).some(time => active.has(Math.round(time * 1000000)))) continue
    const interval = beatInterval(map, beat)
    const offsets = difficulty === 'Swing' ? [0, 2 / 3] : Array.from({ length: division }, (_, sub) => sub / division)
    for (let sub = 0; sub < offsets.length; sub++) {
      const time = map.beats[beat] + interval * offsets[sub]
      if (time >= duration - 0.4) continue
      const slot = (beat - firstBeat) * division + sub
      const intro = !freeForm && slot < introSlots
      const step = (intro ? slot : slot - introSlots + 8 * 1000) % 8
      const hand = freeForm ? null : intro ? (slot % 2 ? 'L' : 'R') : paradiddle[step]
      const position = hand ? [hand === 'L' ? 0.32 : 0.68, 0.5] : route[targets.length % route.length]
      targets.push({ id: targets.length + 1, time, x: position[0], y: position[1], hand, step,
        pattern: difficulty === 'Swing' ? 'Swing' : difficulty === 'Triplet' ? 'Free' : difficulty === 'Easy' ? 'Pulse' : intro ? 'Alternating' : 'Paradiddle', window: hitWindow, resolved: false })
    }
  }
  targets.forEach((target, index) => {
    const before = index ? target.time - targets[index - 1].time : Infinity
    const after = index + 1 < targets.length ? targets[index + 1].time - target.time : Infinity
    target.window = Math.min(hitWindow, before / 2, after / 2)
  })
  return targets
}

export class GameWorld {
  readonly targets: BeatTarget[]
  readonly stats = new RunScore()
  feedback: HitResult[] = []
  lastHit: HitResult | null = null
  cursor = 0
  active: BeatTarget[] = []
  constructor(map: BeatMap, duration: number, readonly difficulty: string) {
    this.targets = createTargets(map, duration, difficulty)
  }

  nextTarget(time: number) {
    return this.targets.find(target => (!target.resolved || (target.timedOut && Math.abs(time - target.time) <= target.window)) && target.time + target.window >= time)
  }

  update(time: number) {
    this.spawn(time)
    for (const target of this.active) {
      if (!target.resolved && time > target.time + target.window + 1e-7) {
        target.timedOut = true; target.comboBeforeMiss = this.stats.combo; target.resolved = true
        this.record({ grade: 'Miss', errorMs: null, x: target.x, y: target.y, time, targetId: target.id, expectedHand: target.hand })
      }
    }
    this.active = this.active.filter(target => !target.resolved)
    this.feedback = this.feedback.filter(hit => time - hit.time < 0.85).slice(-5)
  }

  private spawn(time: number) {
    while (this.cursor < this.targets.length && this.targets[this.cursor].time <= time + approachTime(this.difficulty)) this.active.push(this.targets[this.cursor++])
  }

  strike(hand: Stick, time: number): HitResult {
    this.spawn(time)
    const target = this.nextTarget(time)
    if (!target || target.time > time + approachTime(this.difficulty)) return this.record({ grade: 'No target', errorMs: null, x: 0.5, y: 0.5, time, actualHand: hand })
    return this.judge(target, hand, time)
  }

  hit(x: number, y: number, time: number, width: number, height: number, radius: number, hand: Stick | null = null): HitResult {
    this.spawn(time)
    const recoverable = this.targets.filter(target => target.timedOut && Math.abs(time - target.time) <= target.window)
    const candidates = [...this.active, ...recoverable].filter(target => (!target.resolved || target.timedOut)
      && Math.hypot((target.x - x) * width, (target.y - y) * height) <= radius)
    const target = candidates.sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0]
    if (!target) return this.record({ grade: 'No target', errorMs: null, x, y, time, actualHand: hand })
    return this.judge(target, hand, time)
  }

  private judge(target: BeatTarget, hand: Stick | null, time: number) {
    const error = time - target.time
    const timing = timingGrade(error, target.window)
    if (target.timedOut) {
      this.stats.counts.Miss--
      if (this.lastHit?.targetId === target.id && this.lastHit.grade === 'Miss') this.stats.combo = target.comboBeforeMiss || 0
      this.feedback = this.feedback.filter(hit => hit.targetId !== target.id)
      target.timedOut = false
    }
    if (timing !== 'Too early') target.resolved = true
    const accepted = !['Too early', 'Miss'].includes(timing)
    const grade = accepted && target.hand && target.hand !== hand ? 'Wrong stick' : timing
    return this.record({ grade, timing, errorMs: timing === 'Miss' ? null : Math.round(error * 1000),
      x: target.x, y: target.y, time, targetId: target.id, expectedHand: target.hand, actualHand: hand })
  }

  private record(hit: HitResult): HitResult {
    this.stats.record(hit.grade, hit.errorMs, hit.timing, hit.expectedHand, hit.actualHand)
    this.feedback.push(hit); this.lastHit = hit
    return hit
  }

  finish(time: number) {
    for (const target of this.targets) {
      if (!target.resolved) { target.resolved = true; this.record({ grade: 'Miss', errorMs: null, x: target.x, y: target.y, time, targetId: target.id, expectedHand: target.hand }) }
    }
    this.active = []
  }
}
