import { AudioProcessor } from './audioProcessor'
import { approachTime, BeatTarget, GameWorld, HitResult } from './gameWorld'
import { beatAccent, beatInterval, beatPosition, controlStick, hitWindow, Judgment, paradiddle, Stick, subdivisionsFor, timingWindows } from './rhythm'
import { JudgmentCounts } from './scoring'

export type GameState = 'menu' | 'countdown' | 'playing' | 'paused' | 'complete'
export interface GameSnapshot {
  state: GameState
  score: number
  combo: number
  multiplier: number
  progress: number
  duration: number
  bpm: number
  confidence: number
  feedback: HitResult | null
  countdown: number
  counts: JudgmentCounts
  accuracy: number
  bestCombo: number
  totalTargets: number
  stray: number
  meanError: number
  errors: number[]
  targets: { id: number; x: number; y: number; radius: number; hand: Stick | null }[]
  beat: ReturnType<typeof beatPosition>
  meter: number
  meterVerified: boolean
  division: number
  pattern: string
  patternSteps: Stick[]
  patternStep: number
  expectedStick: Stick | null
  pressed: Record<Stick, boolean>
  timingAccuracy: number
  stickAccuracy: number
  stickAttempts: number
  perfectWindowMs: number
  closeWindowMs: number
  hitWindowMs: number
  level: string
}

const defaultTiming = timingWindows()
const milliseconds = (seconds: number) => Math.round(seconds * 10000) / 10

export const initialSnapshot: GameSnapshot = {
  state: 'menu', score: 0, combo: 0, multiplier: 1, progress: 0, duration: 0, bpm: 120, confidence: 0,
  feedback: null, countdown: 4, counts: { Perfect: 0, Close: 0, Early: 0, Late: 0, Miss: 0, 'Wrong stick': 0 }, accuracy: 100,
  bestCombo: 0, totalTargets: 0, stray: 0, meanError: 0, errors: [], targets: [],
  beat: { total: 0, beat: 0, bar: 0, subdivision: 0, phase: 0 }, meter: 4, meterVerified: false, division: 1,
  pattern: 'Pulse', patternSteps: [], patternStep: 0, expectedStick: null, pressed: { L: false, R: false },
  timingAccuracy: 100, stickAccuracy: 100, stickAttempts: 0,
  perfectWindowMs: milliseconds(defaultTiming.perfect), closeWindowMs: milliseconds(defaultTiming.close), hitWindowMs: milliseconds(defaultTiming.hit),
  level: 'Easy'
}

export const judgmentColors: Record<Judgment, string> = {
  Perfect: '#5df3d1', Close: '#8ebfff', Early: '#ffc581', Late: '#e8a3ff', 'Too early': '#ff9c81', Miss: '#ff708d', 'No target': '#ff708d', 'Wrong stick': '#ff708d'
}

export class FrequencyFrontierGame {
  readonly audioProcessor = new AudioProcessor()
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
  private lastUpdate = 0
  private countdownRemaining = 0
  private pausedState: 'playing' | 'countdown' = 'playing'
  private pausedTime = 0
  private feedback: HitResult | null = null
  private disposed = false
  private difficulty = 'Easy'
  private lastBloomBeat = 0
  private splashes: { x: number; y: number; color: string; born: number; strong: boolean }[] = []
  private heldSticks = new Set<Stick>()
  private flashUntil: Record<Stick, number> = { L: 0, R: 0 }
  private resizeObserver: ResizeObserver

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser does not support Canvas.')
    this.ctx = ctx
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    canvas.addEventListener('pointerdown', this.pointer)
    canvas.addEventListener('contextmenu', this.contextMenu)
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

  private get playfield() {
    const compact = this.height < 500
    const top = compact ? 158 : this.width <= 680 ? 315 : 190
    const bottom = compact ? 100 : this.width <= 680 ? 215 : 185
    const width = Math.min(880, Math.max(100, this.width - 64))
    const height = Math.max(100, this.height - top - bottom)
    return { x: (this.width - width) / 2, y: top, width, height, radius: Math.max(25, Math.min(42, width * 0.09, height * 0.2)) }
  }

  private get time() {
    if (this.gameState === 'paused') return this.pausedTime
    return this.audioProcessor.timeAt() + this.timingOffset / 1000
  }

  private pointer = (event: PointerEvent) => {
    if (this.gameState !== 'playing' || !event.isPrimary || ![0, 2].includes(event.button)) return
    event.preventDefault()
    this.clickAt(event.clientX, event.clientY, event.timeStamp, event.button === 2 ? 'R' : 'L')
  }
  private contextMenu = (event: MouseEvent) => { if (this.gameState === 'playing') event.preventDefault() }

  private inputTime(eventTime: number) {
    const stamp = eventTime > performance.now() + 1000 ? eventTime - performance.timeOrigin : eventTime
    return this.audioProcessor.timeAt(stamp) + this.timingOffset / 1000
  }

  clickAt(clientX: number, clientY: number, eventTime = performance.now(), hand: Stick = 'L') {
    if (this.gameState !== 'playing') return
    const rect = this.canvas.getBoundingClientRect()
    const field = this.playfield
    const x = (clientX - rect.left - field.x) / field.width
    const y = (clientY - rect.top - field.y) / field.height
    this.flashUntil[hand] = performance.now() + 120
    this.feedback = this.gameWorld!.hit(x, y, this.inputTime(eventTime), field.width, field.height, field.radius + 8, hand)
    this.emit()
  }

  strikeStick(hand: Stick, eventTime = performance.now()) {
    if (this.gameState !== 'playing') return
    this.flashUntil[hand] = performance.now() + 120
    this.feedback = this.gameWorld!.strike(hand, this.inputTime(eventTime))
    this.emit()
  }

  private keydown = (event: KeyboardEvent) => {
    const hand = controlStick(event.code, event.location)
    if (hand && this.gameState === 'playing' && !(event.target as HTMLElement)?.closest('input, select, textarea, dialog') && !event.isComposing) {
      event.preventDefault()
      if (event.repeat || this.heldSticks.has(hand)) return
      this.heldSticks.add(hand)
      this.strikeStick(hand, event.timeStamp)
      return
    }
    if ((event.target as HTMLElement)?.closest('button, input, select, textarea, a') || event.repeat) return
    if (event.code === 'Space') {
      event.preventDefault()
      if (this.gameState === 'playing' || this.gameState === 'countdown') this.pauseGame()
      else if (this.gameState === 'paused') void this.resumeGame()
    }
    if (event.code === 'KeyR' && this.gameState === 'complete') void this.restartGame()
  }
  private keyup = (event: KeyboardEvent) => {
    const hand = controlStick(event.code, event.location)
    if (!hand) return
    this.heldSticks.delete(hand)
    this.emit()
  }
  private clearSticks() { this.heldSticks.clear(); this.flashUntil = { L: 0, R: 0 } }
  private blur = () => { this.clearSticks(); this.pauseGame() }
  private visibility = () => { if (document.hidden) this.pauseGame() }
  async unlockAudio() { await this.audioProcessor.initialize() }

  async startGame(difficulty = 'Easy') {
    if (!this.audioProcessor.hasAudio) throw new Error('Choose or upload a song first.')
    this.difficulty = difficulty
    this.audioProcessor.rewind()
    this.gameWorld = new GameWorld(this.audioProcessor.beatMap, this.audioProcessor.duration, difficulty)
    if (!this.gameWorld.targets.length) throw new Error('No clear beat targets were found. Try another recording.')
    this.feedback = null
    this.clearSticks()
    const period = 60 / this.audioProcessor.beatMap.bpm
    const phase = ((this.audioProcessor.beatMap.offset % period) + period) % period - this.timingOffset / 1000
    this.countdownRemaining = 4 * period + 0.08 - phase
    this.gameState = 'countdown'
    this.emit()
    try { await this.audioProcessor.startPlayback(this.countdownRemaining, true) }
    catch (error) { this.returnToMenu(); throw error }
  }

  pauseGame() {
    if (this.gameState !== 'playing' && this.gameState !== 'countdown') return
    this.pausedState = this.gameState
    this.pausedTime = this.time
    if (this.gameState === 'countdown' && this.audioProcessor.isPlaying) this.countdownRemaining = Math.max(0, -this.audioProcessor.timeAt())
    this.audioProcessor.stopPlayback()
    this.clearSticks()
    this.gameState = 'paused'
    this.emit()
  }

  async resumeGame() {
    if (this.gameState !== 'paused') return
    this.gameState = this.pausedState
    try {
      await this.audioProcessor.startPlayback(this.pausedState === 'countdown' ? this.countdownRemaining : 0, this.pausedState === 'countdown')
    } catch {
      this.gameState = 'paused'
    }
    this.emit()
  }

  async restartGame() { await this.startGame(this.difficulty) }
  returnToMenu() {
    this.audioProcessor.rewind()
    this.gameState = 'menu'
    this.gameWorld = null
    this.feedback = null
    this.clearSticks()
    this.emit()
  }

  private emit() {
    const stats = this.gameWorld?.stats
    const field = this.playfield
    const map = this.audioProcessor.beatMap
    const division = subdivisionsFor(this.difficulty)
    const next = this.gameWorld?.nextTarget(this.time)
    const period = 60 / map.bpm
    const phase = ((map.offset % period) + period) % period - this.timingOffset / 1000
    const pattern = next?.pattern || 'Pulse'
    const bands = timingWindows(next?.window ?? hitWindow)
    const beat = beatPosition(this.time, map, division, this.difficulty === 'Swing')
    this.onUpdate?.({
      state: this.gameState, score: stats?.score || 0, combo: stats?.combo || 0, multiplier: stats?.multiplier || 1,
      progress: Math.max(0, Math.min(this.audioProcessor.duration, this.time)), duration: this.audioProcessor.duration,
      bpm: beat.total > 0 ? 60 / beatInterval(map, beat.total - 1) : map.bpm, confidence: map.confidence,
      feedback: this.feedback, countdown: Math.min(4, Math.max(1, Math.ceil((this.countdownRemaining + phase) / period))),
      counts: { ...(stats?.counts || initialSnapshot.counts) }, accuracy: stats?.accuracy ?? 100, bestCombo: stats?.bestCombo || 0,
      totalTargets: this.gameWorld?.targets.length || 0, stray: stats?.stray || 0, meanError: stats?.meanError || 0,
      errors: stats?.errors.slice(-24) || [],
      targets: this.visibleTargets().map(target => ({
        id: target.id, x: field.x + target.x * field.width, y: field.y + target.y * field.height, radius: field.radius, hand: target.hand
      })),
      beat, meter: map.beatsPerBar || 4, meterVerified: !!map.meterVerified, division,
      pattern, patternSteps: pattern === 'Alternating' ? ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'] : pattern === 'Paradiddle' ? paradiddle : [],
      patternStep: next?.step || 0, expectedStick: next?.hand || null,
      pressed: { L: this.heldSticks.has('L') || performance.now() < this.flashUntil.L, R: this.heldSticks.has('R') || performance.now() < this.flashUntil.R },
      timingAccuracy: stats?.timingAccuracy ?? 100, stickAccuracy: stats?.stickAccuracy ?? 100,
      stickAttempts: (stats?.stickCorrect || 0) + (stats?.stickWrong || 0),
      perfectWindowMs: milliseconds(bands.perfect), closeWindowMs: milliseconds(bands.close), hitWindowMs: milliseconds(bands.hit),
      level: this.difficulty
    })
  }

  private loop = (now: number) => {
    if (this.disposed) return
    const rawTime = this.audioProcessor.timeAt()
    if (this.gameState === 'playing' || this.gameState === 'countdown') this.audioProcessor.update()
    if (this.gameState === 'countdown' && this.audioProcessor.isPlaying) {
      this.countdownRemaining = Math.max(0, -rawTime)
      if (rawTime >= 0) this.gameState = 'playing'
    }
    if (this.gameState === 'playing') {
      const lastFeedback = this.gameWorld!.lastHit
      this.gameWorld!.update(this.time)
      if (this.gameWorld!.lastHit !== lastFeedback) this.feedback = this.gameWorld!.lastHit
      if (this.audioProcessor.ended) {
        this.gameWorld!.finish(this.time)
        this.gameState = 'complete'
        this.audioProcessor.stopPlayback()
        this.emit()
      }
    }
    if (this.gameState === 'playing' || this.gameState === 'countdown') this.syncSplashes(this.time)
    this.draw()
    if ((this.gameState === 'playing' || this.gameState === 'countdown') && now - this.lastUpdate > 50) { this.lastUpdate = now; this.emit() }
    this.frame = requestAnimationFrame(this.loop)
  }

  private drawTarget(target: BeatTarget, next: boolean, time: number) {
    const ctx = this.ctx
    const field = this.playfield
    const remaining = target.time - time
    const fraction = Math.max(0, Math.min(1, remaining / approachTime(this.difficulty)))
    const x = field.x + target.x * field.width
    const y = field.y + target.y * field.height
    const color = target.hand === 'L' ? '#8ebfff' : target.hand === 'R' ? '#c3a0ff' : '#5df3d1'
    const radius = field.radius
    ctx.save(); ctx.translate(x, y)
    ctx.globalAlpha = next ? 1 : 0.48
    ctx.strokeStyle = color; ctx.fillStyle = next ? '#16363b' : '#141e33'; ctx.lineWidth = next ? 3 : 2
    ctx.shadowColor = color; ctx.shadowBlur = this.reducedMotion ? 0 : this.intensity * (next ? 16 : 5)
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.shadowBlur = 0
    // The approach ring remains functional under reduced motion; decorative
    // motion is disabled. A radial progress arc supplies a second timing cue.
    ctx.globalAlpha = next ? 0.8 : 0.3
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, radius + fraction * radius * 1.7, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(0, 0, radius - 7, -Math.PI / 2, -Math.PI / 2 + (1 - fraction) * Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = next ? 1 : 0.65
    ctx.fillStyle = '#edf8ff'; ctx.font = `bold ${radius * 0.65}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(target.hand || String(target.id), 0, target.hand ? -5 : 1)
    if (target.hand) { ctx.font = '10px monospace'; ctx.fillText(String(target.id), 0, radius * 0.48) }
    if (next) {
      ctx.font = '10px monospace'; ctx.fillStyle = color
      ctx.fillText(remaining < 0 ? 'LATE' : remaining <= timingWindows(target.window).perfect ? 'HIT!' : 'NEXT', 0, -radius - 14)
    }
    ctx.restore()
  }

  private draw() {
    const ctx = this.ctx, w = this.width, h = this.height
    const time = Math.max(0, this.time)
    const motion = this.reducedMotion ? 0 : this.intensity
    const playing = this.gameState === 'playing'
    ctx.fillStyle = '#070d1c'; ctx.fillRect(0, 0, w, h)
    this.drawAtmosphere(time, motion, playing)
    ctx.strokeStyle = 'rgba(83,144,177,0.07)'; ctx.lineWidth = 1; ctx.beginPath()
    for (let x = 0; x < w; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
    for (let y = 0; y < h; y += 60) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
    ctx.stroke()
    const spectrum = this.audioProcessor.getVisualizationData()
    for (let i = 0; i < spectrum.length; i++) {
      ctx.fillStyle = i < 22 ? '#ff708d' : i < 44 ? '#5df3d1' : '#b396ff'
      ctx.globalAlpha = 0.08 + motion * 0.12
      const barHeight = 5 + spectrum[i] * Math.min(90, h * 0.14) * (this.reducedMotion ? 0.35 : 1)
      ctx.fillRect(i * w / spectrum.length, h - barHeight, w / spectrum.length - 3, barHeight)
    }
    ctx.globalAlpha = 1
    if (this.gameState === 'menu' || this.gameState === 'countdown') return
    const targets = this.visibleTargets()
    const field = this.playfield
    if (targets.length > 1) {
      ctx.strokeStyle = '#567a9366'; ctx.setLineDash([3, 8]); ctx.beginPath()
      ctx.moveTo(field.x + targets[0].x * field.width, field.y + targets[0].y * field.height)
      ctx.lineTo(field.x + targets[1].x * field.width, field.y + targets[1].y * field.height)
      ctx.stroke(); ctx.setLineDash([])
    }
    for (let i = targets.length - 1; i >= 0; i--) this.drawTarget(targets[i], i === 0, time)
    const feedback = this.gameWorld?.feedback || []
    // Doubles hit the same pad quickly: keep one compact local label per pad
    // rather than stacking eight full timing/sticking sentences on top of it.
    for (const hit of feedback.filter((item, index) => !feedback.slice(index + 1).some(other => other.x === item.x && other.y === item.y))) {
      const age = time - hit.time
      if (age < 0 || age > 0.85) continue
      const x = field.x + hit.x * field.width
      const y = field.y + hit.y * field.height
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - age / 0.85)
      ctx.fillStyle = judgmentColors[hit.grade]; ctx.textAlign = 'center'; ctx.font = 'bold 14px monospace'
      ctx.font = `bold ${w <= 680 ? 10 : 13}px monospace`
      const message = hit.grade === 'Wrong stick' ? `Wrong stick: ${hit.expectedHand}`
        : hit.errorMs === null ? hit.grade : `${hit.grade} ${hit.errorMs > 0 ? '+' : ''}${hit.errorMs} ms`
      ctx.fillText(message, Math.max(w <= 680 ? 135 : 160, Math.min(w - (w <= 680 ? 135 : 160), x)), y - field.radius - 30 - age * 20 * motion)
      if (hit.grade !== 'Too early' && hit.grade !== 'No target') {
        ctx.strokeStyle = judgmentColors[hit.grade]; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(x, y, field.radius + age * 65 * motion, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.restore()
    }
  }

  private syncSplashes(time: number) {
    const beat = beatPosition(time, this.audioProcessor.beatMap, 1)
    if (beat.total > 0 && beat.total !== this.lastBloomBeat && beat.phase < 0.12) {
      this.lastBloomBeat = beat.total
      const strong = beat.beat === 1 || beat.beat === 3
      if (!this.reducedMotion && strong && this.splashes.length < 8) {
        const colors = ['#5df3d1', '#ff4fd8', '#ffb15a', '#7aa2ff']
        for (let i = 0; i < (beat.beat === 1 ? 3 : 1); i++) {
          this.splashes.push({ x: 0.12 + ((beat.total * 37 + i * 53) % 76) / 100, y: 0.18 + ((beat.total * 19 + i * 29) % 62) / 100, color: colors[(beat.total + i) % colors.length], born: time, strong: beat.beat === 1 })
        }
      }
    }
    this.splashes = this.splashes.filter(splash => time - splash.born < 0.62)
  }

  private drawAtmosphere(time: number, motion: number, playing: boolean) {
    const ctx = this.ctx, w = this.width, h = this.height
    const beat = playing ? beatPosition(time, this.audioProcessor.beatMap, 1) : { beat: 0, phase: 1 }
    const accent = this.reducedMotion || !playing ? 0.28 : beatAccent(beat.beat) * Math.max(0, 1 - beat.phase / (beat.beat === 1 ? 0.34 : 0.2))
    const bloom = this.reducedMotion ? 1 : 1 + accent * this.intensity * (beat.beat === 1 ? 0.55 : 0.28)
    const washes = [
      { x: 0.18, y: 0.32, color: '93,243,209', radius: 0.62 },
      { x: 0.82, y: 0.24, color: '255,79,216', radius: 0.58 },
      { x: 0.55, y: 0.78, color: '255,177,90', radius: 0.5 }
    ]
    for (const wash of washes) {
      const radius = Math.max(w, h) * wash.radius * bloom
      const gradient = ctx.createRadialGradient(w * wash.x, h * wash.y, radius * 0.08, w * wash.x, h * wash.y, radius)
      gradient.addColorStop(0, `rgba(${wash.color},${0.05 + accent * this.intensity * 0.16})`)
      gradient.addColorStop(0.42, `rgba(${wash.color},${0.025 + accent * this.intensity * 0.07})`)
      gradient.addColorStop(1, 'rgba(7,13,28,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    }
    if (this.reducedMotion) return
    for (const splash of this.splashes) {
      const age = Math.max(0, Math.min(1, (time - splash.born) / 0.62))
      const radius = (splash.strong ? 180 : 120) * (0.35 + age) * (0.7 + this.intensity)
      const gradient = ctx.createRadialGradient(splash.x * w, splash.y * h, 8, splash.x * w, splash.y * h, radius)
      gradient.addColorStop(0, `${splash.color}${Math.round((1 - age) * (splash.strong ? 70 : 40)).toString(16).padStart(2, '0')}`)
      gradient.addColorStop(1, `${splash.color}00`)
      ctx.fillStyle = gradient
      ctx.beginPath(); ctx.arc(splash.x * w, splash.y * h, radius, 0, Math.PI * 2); ctx.fill()
    }
  }

  private visibleTargets() {
    const targets = this.gameWorld?.active.filter(target => !target.resolved) || []
    // Doubles share a pad. Only draw the nearest target at each position;
    // subsequent strokes remain in the pattern strip and timing model.
    return targets.filter((target, index) => targets.findIndex(other => other.x === target.x && other.y === target.y) === index).slice(0, 3)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('pointerdown', this.pointer)
    this.canvas.removeEventListener('contextmenu', this.contextMenu)
    window.removeEventListener('keydown', this.keydown)
    window.removeEventListener('keyup', this.keyup)
    window.removeEventListener('blur', this.blur)
    document.removeEventListener('visibilitychange', this.visibility)
    this.audioProcessor.dispose()
    this.onUpdate = undefined
  }
}
