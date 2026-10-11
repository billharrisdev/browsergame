import { AudioProcessor } from './audioProcessor'
import { GameWorld } from './gameWorld'
import { FrequencyMode, modeColors, Player } from './player'
import { nearestBeatDistance, timingGrade } from './rhythm'

export type GameState = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameOver' | 'complete'
export interface GameSnapshot {
  state: GameState
  score: number
  health: number
  mode: FrequencyMode
  combo: number
  multiplier: number
  progress: number
  duration: number
  bpm: number
  confidence: number
  feedback: string
  countdown: number
  collected: number
  perfect: number
  missed: number
  bestCombo: number
  burst: boolean
  levels: { bass: number; mid: number; high: number }
}

export class FrequencyFrontierGame {
  readonly audioProcessor = new AudioProcessor()
  player = new Player()
  gameWorld: GameWorld | null = null
  gameState: GameState = 'menu'
  onUpdate?: (snapshot: GameSnapshot) => void
  reducedMotion = false
  intensity = 0.65
  timingOffset = 0
  private ctx: CanvasRenderingContext2D
  private width = 800
  private height = 600
  private frame = 0
  private lastFrame = 0
  private lastUpdate = 0
  private countdownRemaining = 3
  private pausedState: 'playing' | 'countdown' = 'playing'
  private feedback = ''
  private feedbackUntil = 0
  private disposed = false
  private difficulty = 'Easy'
  private keys = new Set<string>()
  private resizeObserver: ResizeObserver

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser does not support Canvas.')
    this.ctx = ctx
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    canvas.addEventListener('pointerdown', this.pointer)
    canvas.addEventListener('pointermove', this.pointer)
    window.addEventListener('keydown', this.keydown)
    window.addEventListener('keyup', this.keyup)
    window.addEventListener('blur', this.blur)
    document.addEventListener('visibilitychange', this.visibility)
    this.frame = requestAnimationFrame(this.loop)
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.width = Math.max(1, rect.width)
    this.height = Math.max(1, rect.height)
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(this.width * ratio)
    this.canvas.height = Math.round(this.height * ratio)
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  private pointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch' && event.type === 'pointermove' && !event.buttons) return
    if (event.type === 'pointerdown') this.canvas.setPointerCapture(event.pointerId)
    const rect = this.canvas.getBoundingClientRect()
    this.player.targetX = (event.clientX - rect.left) / rect.width
    this.player.targetY = (event.clientY - rect.top) / rect.height
  }
  private keydown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement)?.closest('button, input, select, textarea, a')) return
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
    this.keys.add(event.code)
    if (event.repeat) return
    if (event.code === 'Space') {
      if (this.gameState === 'playing' || this.gameState === 'countdown') this.pauseGame()
      else if (this.gameState === 'paused') void this.resumeGame()
    }
    if (event.code === 'KeyR' && ['complete', 'gameOver'].includes(this.gameState)) this.restartGame()
    const mode = ({ Digit1: 'bass', Digit2: 'mid', Digit3: 'high' } as const)[event.code]
    if (mode) this.setMode(mode)
  }
  private keyup = (event: KeyboardEvent) => { this.keys.delete(event.code) }
  private blur = () => { this.keys.clear(); this.pauseGame() }
  private visibility = () => { if (document.hidden) this.blur() }

  async unlockAudio() { await this.audioProcessor.initialize() }
  setMode(mode: FrequencyMode) { this.player.mode = mode; this.emit() }

  startGame(difficulty = 'Easy') {
    if (!this.audioProcessor.hasAudio) throw new Error('Choose or upload a song first.')
    this.difficulty = difficulty
    this.audioProcessor.rewind()
    this.player = new Player()
    this.gameWorld = new GameWorld(this.audioProcessor.beatMap, this.audioProcessor.duration, difficulty)
    this.countdownRemaining = 3
    this.feedback = ''
    this.gameState = 'countdown'
    this.emit()
  }

  pauseGame() {
    if (this.gameState !== 'playing' && this.gameState !== 'countdown') return
    this.pausedState = this.gameState
    this.audioProcessor.stopPlayback()
    this.gameState = 'paused'
    this.emit()
  }

  async resumeGame() {
    if (this.gameState !== 'paused') return
    const resumedState = this.pausedState
    this.gameState = resumedState
    this.emit()
    try {
      if (resumedState === 'playing') await this.audioProcessor.startPlayback()
    } catch {
      if (this.disposed) return
      this.gameState = 'paused'
      this.feedback = 'Audio could not resume. Try again.'
      this.emit()
    }
  }

  restartGame() { this.startGame(this.difficulty) }
  returnToMenu() {
    this.audioProcessor.rewind()
    this.gameState = 'menu'
    this.gameWorld = null
    this.keys.clear()
    this.emit()
  }

  private emit() {
    const time = this.audioProcessor.currentTime
    this.onUpdate?.({
      state: this.gameState, score: this.player.score, health: this.player.health, mode: this.player.mode,
      combo: this.player.combo, multiplier: this.player.multiplier, progress: time, duration: this.audioProcessor.duration,
      bpm: this.audioProcessor.beatMap.bpm, confidence: this.audioProcessor.beatMap.confidence,
      feedback: time < this.feedbackUntil || this.gameState === 'paused' ? this.feedback : '', countdown: Math.ceil(this.countdownRemaining),
      collected: this.player.collected, perfect: this.player.perfect, missed: this.player.missed, bestCombo: this.player.bestCombo,
      burst: time < this.player.burstUntil, levels: this.audioProcessor.getNormalizedLevels()
    })
  }

  private loop = (now: number) => {
    if (this.disposed) return
    const delta = Math.min(0.05, Math.max(0, (now - (this.lastFrame || now)) / 1000))
    this.lastFrame = now
    if (this.gameState === 'countdown') {
      this.countdownRemaining -= delta
      if (this.countdownRemaining <= 0) {
        this.gameState = 'playing'
        void this.audioProcessor.startPlayback().catch(() => {
          this.gameState = 'paused'
          this.pausedState = 'playing'
          this.feedback = 'Audio could not start. Press Resume to try again.'
          this.emit()
        })
      }
    }
    if (this.gameState === 'playing') this.update(delta)
    this.draw()
    if ((this.gameState === 'playing' || this.gameState === 'countdown') && now - this.lastUpdate > 80) {
      this.lastUpdate = now
      this.emit()
    }
    this.frame = requestAnimationFrame(this.loop)
  }

  private update(delta: number) {
    this.audioProcessor.update()
    const time = this.audioProcessor.currentTime + this.timingOffset / 1000
    const player = this.player
    const horizontal = Number(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - Number(this.keys.has('ArrowLeft') || this.keys.has('KeyA'))
    const vertical = Number(this.keys.has('ArrowDown') || this.keys.has('KeyS')) - Number(this.keys.has('ArrowUp') || this.keys.has('KeyW'))
    if (horizontal || vertical) {
      player.targetX = player.x + horizontal * delta * 0.7
      player.targetY = player.y + vertical * delta * 0.9
    }
    player.move(delta, this.width, this.height)
    this.gameWorld!.update(time, delta)
    for (const encounter of this.gameWorld!.active) {
      const x = 0.28 + (encounter.time - time) * 0.28
      const distance = Math.hypot((x - player.x) * this.width, (encounter.y - player.y) * this.height)
      // Resolve notes at their closest horizontal approach, so a player on the
      // beat line can earn Perfect rather than collecting at the leading edge.
      if (distance < (encounter.kind === 'note' ? 32 : 40) && (encounter.kind === 'hazard' || x <= player.x)) {
        encounter.resolved = true
        if (encounter.kind === 'note') {
          const grade = timingGrade(time - encounter.time)
          const matched = player.mode === encounter.mode
          player.collect(grade, matched, time)
          this.feedback = matched ? `${grade}${player.combo >= 16 && player.combo % 16 === 0 ? ' · RESONANCE!' : ''}` : 'Collected · match the symbol for combos'
          this.gameWorld!.explode(x, encounter.y, modeColors[encounter.mode], this.reducedMotion)
        } else if (player.mode === 'bass') {
          player.score += 75
          this.feedback = 'Phased! +75'
          this.gameWorld!.explode(x, encounter.y, modeColors.bass, this.reducedMotion)
        } else if (player.damage(time)) {
          this.feedback = 'Hit! Switch to bass or dodge'
          this.gameWorld!.explode(player.x, player.y, '#ff708d', this.reducedMotion)
        }
        this.feedbackUntil = time + 0.65
      } else if (x < -0.05) {
        encounter.resolved = true
        if (encounter.kind === 'note') { player.missed++; player.combo = 0 }
      }
    }
    if (player.health <= 0) {
      this.gameState = 'gameOver'
      this.audioProcessor.stopPlayback()
      this.emit()
    } else if (this.audioProcessor.ended) {
      for (const encounter of this.gameWorld!.encounters) {
        if (!encounter.resolved && encounter.kind === 'note') { player.missed++; encounter.resolved = true }
      }
      this.gameState = 'complete'
      this.audioProcessor.stopPlayback()
      this.emit()
    }
  }

  private draw() {
    const ctx = this.ctx
    const w = this.width
    const h = this.height
    const time = this.audioProcessor.currentTime + this.timingOffset / 1000
    const active = this.gameState !== 'menu'
    const levels = this.audioProcessor.getNormalizedLevels()
    const motion = this.reducedMotion ? 0 : this.intensity
    const pulse = active ? Math.max(0, 1 - nearestBeatDistance(time, this.audioProcessor.beatMap) / 0.18) : 0
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#070d1c'
    ctx.fillRect(0, 0, w, h)
    const gradient = ctx.createRadialGradient(w * 0.55, h * 0.5, 10, w * 0.55, h * 0.5, w * 0.7)
    gradient.addColorStop(0, `rgba(23,54,86,${0.45 + levels.bass * motion * 0.35})`)
    gradient.addColorStop(1, 'rgba(7,13,28,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = 1
    ctx.strokeStyle = `rgba(83,144,177,${0.08 + pulse * motion * 0.08})`
    ctx.beginPath()
    const shift = (time * 18 * motion) % 60
    for (let x = -60 + shift; x < w; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
    for (let y = 0; y < h; y += 60) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
    ctx.stroke()

    const spectrum = this.audioProcessor.getVisualizationData()
    for (let i = 0; i < spectrum.length; i++) {
      ctx.fillStyle = i < 22 ? '#ff708d' : i < 44 ? '#5df3d1' : '#b396ff'
      ctx.globalAlpha = 0.1 + motion * 0.12
      const barHeight = 8 + spectrum[i] * h * 0.24 * (this.reducedMotion ? 0.35 : 1)
      ctx.fillRect(i * w / spectrum.length, h - barHeight, w / spectrum.length - 3, barHeight)
    }
    ctx.globalAlpha = 1
    if (!active) return

    // The collection line is a consistent spatial reference for beat timing.
    ctx.strokeStyle = `rgba(93,243,209,${0.15 + pulse * motion * 0.25})`
    ctx.setLineDash([4, 10])
    ctx.beginPath(); ctx.moveTo(w * 0.28, h * 0.14); ctx.lineTo(w * 0.28, h * 0.88); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#6d879e'; ctx.font = '10px monospace'; ctx.fillText('BEAT LINE', w * 0.28 - 27, h * 0.1)

    const upcoming = this.gameWorld?.encounters.find(encounter => !encounter.resolved && encounter.kind === 'note' && encounter.time > time)
    if (upcoming) {
      ctx.strokeStyle = modeColors[upcoming.mode]
      ctx.globalAlpha = 0.2 + pulse * motion * 0.15
      ctx.beginPath(); ctx.arc(w * 0.28, upcoming.y * h, 28, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
    }
    for (const encounter of this.gameWorld?.active || []) {
      if (encounter.resolved) continue
      const x = (0.28 + (encounter.time - time) * 0.28) * w
      const y = encounter.y * h
      if (x > w + 40 || x < -40) continue
      const color = encounter.kind === 'note' ? modeColors[encounter.mode] : '#ff9c6c'
      ctx.save(); ctx.translate(x, y)
      ctx.shadowColor = color; ctx.shadowBlur = 10 * motion
      ctx.strokeStyle = color; ctx.fillStyle = encounter.kind === 'note' ? '#122333' : '#311c26'; ctx.lineWidth = 2
      ctx.beginPath()
      if (encounter.kind === 'hazard') {
        for (let i = 0; i < 16; i++) {
          const angle = i / 16 * Math.PI * 2
          const radius = i % 2 ? 16 : 26
          if (!i) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
          else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        }
        ctx.closePath()
      } else if (encounter.mode === 'high') {
        ctx.moveTo(0, -15); ctx.lineTo(15, 0); ctx.lineTo(0, 15); ctx.lineTo(-15, 0); ctx.closePath()
      } else if (encounter.mode === 'bass') ctx.rect(-12, -12, 24, 24)
      else ctx.arc(0, 0, 13, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = 'bold 11px monospace'
      ctx.fillText(encounter.kind === 'hazard' ? '!' : encounter.mode === 'bass' ? '1' : encounter.mode === 'mid' ? '2' : '3', 0, 4)
      ctx.restore()
    }

    const player = this.player
    const color = modeColors[player.mode]
    if (!this.reducedMotion && player.trail.length > 1) {
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = 0.25
      ctx.beginPath()
      player.trail.forEach((point, index) => { if (!index) ctx.moveTo(point.x * w, point.y * h); else ctx.lineTo(point.x * w, point.y * h) })
      ctx.stroke(); ctx.globalAlpha = 1
    }
    ctx.save(); ctx.translate(player.x * w, player.y * h)
    ctx.shadowColor = color; ctx.shadowBlur = 18 * motion
    ctx.globalAlpha = time < player.invulnerableUntil ? 0.55 : 1
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 22 + pulse * motion * 9, 0, Math.PI * 2); ctx.stroke()
    if (time < player.burstUntil) {
      ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    if (motion > 0) {
      ctx.strokeStyle = color; ctx.globalAlpha = pulse * motion * 0.15
      ctx.beginPath(); ctx.arc(player.x * w, player.y * h, 40 + (1 - pulse) * 120, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
    }
    for (const particle of this.gameWorld?.particles || []) {
      ctx.globalAlpha = Math.max(0, particle.life / 0.6) * motion
      ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x * w, particle.y * h, 3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('pointerdown', this.pointer)
    this.canvas.removeEventListener('pointermove', this.pointer)
    window.removeEventListener('keydown', this.keydown)
    window.removeEventListener('keyup', this.keyup)
    window.removeEventListener('blur', this.blur)
    document.removeEventListener('visibilitychange', this.visibility)
    this.audioProcessor.dispose()
    this.onUpdate = undefined
  }
}
