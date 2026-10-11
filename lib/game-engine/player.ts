export type FrequencyMode = 'bass' | 'mid' | 'high'
export const modeColors: Record<FrequencyMode, string> = { bass: '#ff708d', mid: '#5df3d1', high: '#b396ff' }
export const modeFrequencies: Record<FrequencyMode, number> = { bass: 120, mid: 440, high: 6000 }

export class Player {
  x = 0.28
  y = 0.5
  targetX = 0.28
  targetY = 0.5
  mode: FrequencyMode = 'mid'
  health = 100
  score = 0
  combo = 0
  bestCombo = 0
  collected = 0
  perfect = 0
  missed = 0
  burstUntil = 0
  invulnerableUntil = 0
  trail: { x: number; y: number }[] = []

  get multiplier() { return Math.min(5, 1 + Math.floor(this.combo / 8)) }

  move(delta: number, width: number, height: number) {
    const dx = (this.targetX - this.x) * width
    const dy = (this.targetY - this.y) * height
    const distance = Math.hypot(dx, dy)
    const speed = this.mode === 'bass' ? 470 : this.mode === 'mid' ? 650 : 850
    const step = Math.min(distance, speed * delta)
    if (distance > 0) { this.x += dx / distance * step / width; this.y += dy / distance * step / height }
    this.x = Math.max(0.04, Math.min(0.96, this.x))
    this.y = Math.max(0.12, Math.min(0.9, this.y))
    this.trail.push({ x: this.x, y: this.y })
    if (this.trail.length > 24) this.trail.shift()
  }

  collect(grade: string, matched: boolean, time: number) {
    this.collected++
    if (grade === 'Perfect') this.perfect++
    if (matched && grade !== 'Collected') this.combo++
    else this.combo = Math.max(0, this.combo - 1)
    this.bestCombo = Math.max(this.bestCombo, this.combo)
    if (this.combo > 0 && this.combo % 16 === 0 && matched && grade !== 'Collected') {
      this.burstUntil = time + 4
      this.health = Math.min(100, this.health + 8)
    }
    const points = grade === 'Perfect' ? 150 : grade === 'Good' ? 100 : 50
    this.score += points * (matched ? this.multiplier : 1) * (time < this.burstUntil ? 2 : 1)
  }

  damage(time: number) {
    if (time < this.invulnerableUntil || time < this.burstUntil) return false
    this.health = Math.max(0, this.health - (this.mode === 'high' ? 24 : 16))
    this.combo = 0
    this.invulnerableUntil = time + 1.2
    return true
  }
}
