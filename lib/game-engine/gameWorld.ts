import { beatInterval, BeatMap, describeTiming, hitWindow, Judgment, paradiddle, Stick, subdivisionsFor, timingGrade } from './rhythm'
import { RunScore } from './scoring'

export interface BeatTarget {
  id: number; time: number; x: number; y: number; resolved: boolean
  hand: Stick | null; pattern: 'Pulse' | 'Alternating' | 'Paradiddle' | 'Free' | 'Swing'; step: number; window: number
  timedOut?: boolean; comboBeforeMiss?: number
  best?: { time: number; hand: Stick | null; error: number }
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
  readonly performance: { time: number; hand: Stick | null; x: number; y: number }[] = []
  cursor = 0
  active: BeatTarget[] = []
  constructor(map: BeatMap, duration: number, readonly difficulty: string) {
    this.targets = createTargets(map, duration, difficulty)
  }

  nextTarget(time: number) {
    return this.targets.find(target => !target.resolved && target.time + target.window + 1e-7 >= time)
  }

  update(time: number) {
    this.spawn(time)
    for (const target of this.active) this.close(target, time)
    this.active = this.active.filter(target => !target.resolved)
    this.feedback = this.feedback.filter(hit => time - hit.time < 0.85).slice(-5)
  }

  private spawn(time: number) {
    while (this.cursor < this.targets.length && this.targets[this.cursor].time <= time + approachTime(this.difficulty)) this.active.push(this.targets[this.cursor++])
  }

  strike(hand: Stick, time: number): HitResult {
    this.spawn(time)
    this.performance.push({ time, hand, x: 0.5, y: 0.5 })
    const target = this.noteAt(time)
    if (!target) return this.unscored(hand, time, 0.5, 0.5)
    return this.consider(target, hand, time, 0.5, 0.5)
  }

  hit(x: number, y: number, time: number, width: number, height: number, radius: number, hand: Stick | null = null): HitResult {
    this.spawn(time)
    this.performance.push({ time, hand, x, y })
    const target = this.padAt(x, y, time, width, height, radius)
    if (!target) return this.unscored(hand, time, x, y)
    return this.consider(target, hand, time, x, y)
  }

  private noteAt(time: number) {
    return this.openAt(time)[0]
  }

  private padAt(x: number, y: number, time: number, width: number, height: number, radius: number) {
    return this.openAt(time).filter(target => Math.hypot((target.x - x) * width, (target.y - y) * height) <= radius)[0]
  }

  private openAt(time: number) {
    return this.targets.filter(target => (!target.resolved || target.timedOut) && Math.abs(time - target.time) <= target.window + 1e-7)
      .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))
  }

  private consider(target: BeatTarget, hand: Stick | null, time: number, x: number, y: number) {
    const error = time - target.time
    if (target.best && Math.abs(error) >= Math.abs(target.best.error) - 1e-9) return this.unscored(hand, time, x, y)
    if (target.best) this.stats.stray++
    const recovering = !!target.timedOut
    if (recovering) this.undoMiss(target)
    target.best = { time, hand, error }
    const shown = this.preview(target, hand, time)
    if (recovering) { target.resolved = true; this.commit(target) }
    return shown
  }

  private preview(target: BeatTarget, hand: Stick | null, time: number) {
    const error = time - target.time
    const { grade, timing } = this.gradeFor(target, hand, error)
    const hit: HitResult = { grade, timing, errorMs: Math.round(error * 1000), x: target.x, y: target.y, time, targetId: target.id, expectedHand: target.hand, actualHand: hand }
    this.feedback = this.feedback.filter(item => item.targetId !== target.id)
    this.feedback.push(hit); this.lastHit = hit
    return hit
  }

  private commit(target: BeatTarget) {
    const best = target.best
    if (!best) return
    const { grade, timing } = this.gradeFor(target, best.hand, best.error)
    this.stats.record(grade, Math.round(best.error * 1000), timing, target.hand, best.hand)
  }

  private gradeFor(target: BeatTarget, hand: Stick | null, error: number) {
    const timing = timingGrade(error, target.window)
    const accepted = !['Too early', 'Miss'].includes(timing)
    const grade = accepted && target.hand && target.hand !== hand ? 'Wrong stick' : timing
    return { grade, timing }
  }

  private close(target: BeatTarget, time: number) {
    if (target.resolved || time <= target.time + target.window + 1e-7) return
    target.resolved = true
    if (target.best) { this.commit(target); return }
    target.timedOut = true; target.comboBeforeMiss = this.stats.combo
    this.record({ grade: 'Miss', errorMs: null, x: target.x, y: target.y, time, targetId: target.id, expectedHand: target.hand })
  }

  private undoMiss(target: BeatTarget) {
    if (this.stats.counts.Miss > 0) this.stats.counts.Miss--
    const later = this.targets.some(other => other.id !== target.id && other.resolved && !other.timedOut && other.time >= target.time)
    if (!later) this.stats.combo = target.comboBeforeMiss || 0
    this.feedback = this.feedback.filter(hit => hit.targetId !== target.id)
    target.timedOut = false; target.resolved = false
  }

  private unscored(hand: Stick | null, time: number, x: number, y: number) {
    return this.record({ grade: 'No target', errorMs: null, x, y, time, actualHand: hand })
  }

  private record(hit: HitResult): HitResult {
    this.stats.record(hit.grade, hit.errorMs, hit.timing, hit.expectedHand, hit.actualHand)
    this.feedback.push(hit); this.lastHit = hit
    return hit
  }

  finish(time: number) {
    for (const target of this.targets) {
      if (target.resolved) continue
      target.resolved = true
      if (target.best) this.commit(target)
      else this.record({ grade: 'Miss', errorMs: null, x: target.x, y: target.y, time, targetId: target.id, expectedHand: target.hand })
    }
    this.active = []
  }
}
