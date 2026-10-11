import { BeatMap } from './rhythm'
import { FrequencyMode } from './player'

export interface Encounter {
  time: number
  y: number
  mode: FrequencyMode
  kind: 'note' | 'hazard'
  resolved: boolean
}

// A deterministic musical route: nearby lanes, a frequency change each phrase,
// and hazards on a different lane from that phrase's notes.
export function createEncounters(map: BeatMap, duration: number, difficulty: string): Encounter[] {
  const encounters: Encounter[] = []
  const modes: FrequencyMode[] = ['mid', 'high', 'bass']
  const lanes = [0.32, 0.5, 0.7]
  const stride = difficulty === 'Easy' ? 2 : 1
  for (let beat = 0; beat < map.beats.length; beat++) {
    const time = map.beats[beat]
    if (time < 3 || time > duration - 1) continue
    const phrase = Math.floor(beat / 8)
    const lane = phrase % 3
    if (beat % stride === 0) {
      encounters.push({ time, y: lanes[lane] + Math.sin(beat * 0.6) * 0.035, mode: modes[phrase % 3], kind: 'note', resolved: false })
    }
    if (beat % (difficulty === 'Hard' ? 8 : 16) === 4 && time > 9) {
      encounters.push({ time, y: lanes[(lane + 1) % 3], mode: 'bass', kind: 'hazard', resolved: false })
    }
  }
  return encounters.sort((a, b) => a.time - b.time)
}

export class GameWorld {
  encounters: Encounter[]
  cursor = 0
  active: Encounter[] = []
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = []

  constructor(map: BeatMap, duration: number, difficulty: string) {
    this.encounters = createEncounters(map, duration, difficulty)
  }

  update(time: number, delta: number) {
    while (this.cursor < this.encounters.length && this.encounters[this.cursor].time < time + 3) {
      this.active.push(this.encounters[this.cursor++])
    }
    this.active = this.active.filter(encounter => !encounter.resolved && encounter.time > time - 3)
    this.particles = this.particles.filter(particle => {
      particle.life -= delta
      particle.x += particle.vx * delta
      particle.y += particle.vy * delta
      return particle.life > 0
    })
  }

  explode(x: number, y: number, color: string, reducedMotion: boolean) {
    if (reducedMotion) return
    for (let i = 0; i < 12 && this.particles.length < 180; i++) {
      const angle = i / 12 * Math.PI * 2
      this.particles.push({ x, y, vx: Math.cos(angle) * 0.12, vy: Math.sin(angle) * 0.16, life: 0.6, color })
    }
  }
}
