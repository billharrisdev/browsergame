export type LevelId = 'Easy' | 'Normal' | 'Triplet' | 'Soon' | 'Sixteenth'
export const levelChoices: { id: LevelId; label: string; playable: boolean; note: string }[] = [
  { id: 'Easy', label: '1 · Pulse', playable: true, note: 'Quarter notes on any pad' },
  { id: 'Normal', label: '2 · Eighths', playable: true, note: 'R L R R · L R L L' },
  { id: 'Triplet', label: '3 · Triplets', playable: true, note: '1 trip let · any pad' },
  { id: 'Soon', label: '4 · Coming soon', playable: false, note: 'A new pattern is on the way' },
  { id: 'Sixteenth', label: '5 · Sixteenths', playable: false, note: 'Sixteenth paradiddles are not open yet' }
]
const tripletSongs = new Set(['bebop-25', 'big-swing-band'])
export const uploadLevels: LevelId[] = ['Easy', 'Normal']
export function levelsFor(track: { id: string; levels?: LevelId[] }): LevelId[] {
  return track.levels?.length ? track.levels : tripletSongs.has(track.id) ? ['Easy', 'Triplet'] : ['Easy', 'Normal']
}
export function songsForLevel<T extends { id: string; levels?: LevelId[] }>(level: LevelId, list: T[]) {
  if (!levelChoices.find(choice => choice.id === level)?.playable) return []
  return list.filter(track => levelsFor(track).includes(level))
}
