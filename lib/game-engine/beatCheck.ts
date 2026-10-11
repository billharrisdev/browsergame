export type CheckGrid = 'pulse' | 'half' | 'double' | 'swing' | 'swing-double' | 'triplets'
export const checkGrids: { id: CheckGrid; label: string }[] = [
  { id: 'pulse', label: 'Detected pulse' },
  { id: 'half', label: 'Half-time' },
  { id: 'double', label: 'Double-time' },
  { id: 'swing', label: 'Swing' },
  { id: 'swing-double', label: 'Swing double-time' },
  { id: 'triplets', label: 'Triplets' }
]

export function heardBpm(bpm: number, grid: CheckGrid) {
  return grid === 'half' ? bpm / 2 : grid === 'double' || grid === 'swing-double' ? bpm * 2 : bpm
}

export function checkClicks(beats: number[], meter = 4, grid: CheckGrid = 'pulse') {
  const clicks: { time: number; accent: boolean }[] = []
  const push = (time: number, accent: boolean) => {
    if (!Number.isFinite(time) || time < 0) return
    if (clicks.length && time < clicks[clicks.length - 1].time + 0.03) return
    clicks.push({ time, accent })
  }
  for (let index = 0; index < beats.length; index++) {
    const next = beats[index + 1]
    const previous = beats[index - 1]
    const interval = next !== undefined ? next - beats[index] : previous !== undefined ? beats[index] - previous : 0.5
    if (interval <= 0.05) continue
    const downbeat = index % meter === 0
    if (grid === 'pulse') push(beats[index], downbeat)
    else if (grid === 'half') { if (index % 2 === 0) push(beats[index], index % (meter * 2) === 0) }
    else if (grid === 'double') { push(beats[index], downbeat); push(beats[index] + interval / 2, false) }
    else if (grid === 'swing') { push(beats[index], downbeat); push(beats[index] + interval * 2 / 3, false) }
    else if (grid === 'swing-double') {
      const half = interval / 2
      push(beats[index], downbeat)
      push(beats[index] + half * 2 / 3, false)
      push(beats[index] + half, false)
      push(beats[index] + half + half * 2 / 3, false)
    } else {
      push(beats[index], downbeat)
      push(beats[index] + interval / 3, false)
      push(beats[index] + interval * 2 / 3, false)
    }
  }
  return clicks
}
