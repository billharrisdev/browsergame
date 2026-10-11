import { Judgment } from './rhythm'

export type JudgmentCounts = Record<'Perfect' | 'Close' | 'Early' | 'Late' | 'Miss', number>
export class RunScore {
  score = 0
  combo = 0
  bestCombo = 0
  stray = 0
  counts: JudgmentCounts = { Perfect: 0, Close: 0, Early: 0, Late: 0, Miss: 0 }
  errors: number[] = []
  get resolved() { return Object.values(this.counts).reduce((sum, value) => sum + value, 0) }
  get multiplier() { return Math.min(5, 1 + Math.floor(this.combo / 10)) }
  get accuracy() {
    const attempts = this.resolved + this.stray
    const weighted = this.counts.Perfect + this.counts.Close * 0.7 + (this.counts.Early + this.counts.Late) * 0.35
    return attempts ? weighted / attempts * 100 : 100
  }
  get meanError() { return this.errors.length ? this.errors.reduce((sum, value) => sum + value, 0) / this.errors.length : 0 }

  record(grade: Judgment, errorMs: number | null) {
    if (grade === 'Too early' || grade === 'No target') { this.stray++; this.combo = 0; return }
    this.counts[grade]++
    if (grade === 'Miss') { this.combo = 0; return }
    if (errorMs !== null) this.errors.push(errorMs)
    if (grade === 'Perfect' || grade === 'Close') this.combo++
    else this.combo = 0
    this.bestCombo = Math.max(this.bestCombo, this.combo)
    const points = grade === 'Perfect' ? 300 : grade === 'Close' ? 200 : 75
    this.score += points * this.multiplier
  }
}
