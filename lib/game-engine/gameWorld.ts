import { BeatMap, hitWindow, Judgment, timingGrade } from './rhythm'
import { RunScore } from './scoring'

export interface BeatTarget { id: number; time: number; x: number; y: number; resolved: boolean; timedOut?: boolean; comboBeforeMiss?: number }
export interface HitResult { grade: Judgment; errorMs: number | null; x: number; y: number; time: number; targetId?: number }
export const approachTime = (difficulty: string) => difficulty === 'Easy' ? 1.2 : difficulty === 'Hard' ? 0.7 : 0.95

export function createTargets(map: BeatMap, duration: number, difficulty: string): BeatTarget[] {
  const times = map.notes || map.beats
  const route = [[0.2, 0.27], [0.5, 0.22], [0.8, 0.34], [0.77, 0.72], [0.47, 0.77], [0.2, 0.67]]
  const stride = difficulty === 'Easy' ? 2 : 1
  return times.filter((time, index) => index % stride === 0 && time >= 1.5 && time < duration - 0.4).map((time, index) => ({
    id: index + 1, time, x: route[index % route.length][0], y: route[index % route.length][1], resolved: false
  }))
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

  update(time: number) {
    while (this.cursor < this.targets.length && this.targets[this.cursor].time <= time + approachTime(this.difficulty)) {
      this.active.push(this.targets[this.cursor++])
    }
    for (const target of this.active) {
      if (!target.resolved && time > target.time + hitWindow) {
        target.timedOut = true
        target.comboBeforeMiss = this.stats.combo
        target.resolved = true
        this.record({ grade: 'Miss', errorMs: null, x: target.x, y: target.y, time, targetId: target.id })
      }
    }
    this.active = this.active.filter(target => !target.resolved)
    this.feedback = this.feedback.filter(hit => time - hit.time < 0.85).slice(-5)
  }

  hit(x: number, y: number, time: number, width: number, height: number, radius: number): HitResult {
    // Update spawning at the input timestamp, but do not expire targets until
    // after judging: an event queued for a few ms must retain its original time.
    while (this.cursor < this.targets.length && this.targets[this.cursor].time <= time + approachTime(this.difficulty)) {
      this.active.push(this.targets[this.cursor++])
    }
    const recoverable = this.targets.filter(target => target.timedOut && Math.abs(time - target.time) <= hitWindow)
    const candidates = [...this.active, ...recoverable].filter(target => (!target.resolved || target.timedOut)
      && Math.hypot((target.x - x) * width, (target.y - y) * height) <= radius)
    const target = candidates.sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0]
    if (!target) return this.record({ grade: 'No target', errorMs: null, x, y, time })
    if (target.timedOut) {
      this.stats.counts.Miss--
      if (this.lastHit?.targetId === target.id && this.lastHit.grade === 'Miss') this.stats.combo = target.comboBeforeMiss || 0
      this.feedback = this.feedback.filter(hit => hit.targetId !== target.id)
      target.timedOut = false
    }
    const error = time - target.time
    const grade = timingGrade(error)
    if (grade !== 'Too early') target.resolved = true
    return this.record({ grade, errorMs: grade === 'Miss' ? null : Math.round(error * 1000), x: target.x, y: target.y, time, targetId: target.id })
  }

  private record(hit: HitResult): HitResult {
    this.stats.record(hit.grade, hit.errorMs)
    this.feedback.push(hit)
    this.lastHit = hit
    return hit
  }

  finish(time: number) {
    for (const target of this.targets) {
      if (!target.resolved) { target.resolved = true; this.record({ grade: 'Miss', errorMs: null, x: target.x, y: target.y, time, targetId: target.id }) }
    }
    this.active = []
  }
}
