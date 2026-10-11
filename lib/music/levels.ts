export type LevelId = 'Easy' | 'Normal' | 'Triplet' | 'Swing' | 'Sixteenth'
export const levelChoices: { id: LevelId; label: string; playable: boolean; note: string }[] = [
  { id: 'Easy', label: '1 · Pulse', playable: true, note: 'Quarter notes on any pad' },
  { id: 'Normal', label: '2 · Eighths', playable: true, note: 'R L R R · L R L L' },
  { id: 'Triplet', label: '3 · Triplets', playable: true, note: '1 trip let · any pad' },
  { id: 'Swing', label: '4 · Swing', playable: true, note: 'Long-short eighths · any pad' },
  { id: 'Sixteenth', label: '5 · Sixteenths', playable: false, note: 'Sixteenth paradiddles are not open yet' }
]
const tripletSongs = new Set(['bebop-25'])
const swingSongs = new Set(['big-swing-band'])
export const uploadLevels: LevelId[] = ['Easy', 'Normal']
export function levelsFor(track: { id: string; levels?: LevelId[] }): LevelId[] {
  if (track.levels?.length) return track.levels
  if (tripletSongs.has(track.id)) return ['Easy', 'Triplet']
  if (swingSongs.has(track.id)) return ['Easy', 'Swing']
  return ['Easy', 'Normal']
}
export function songsForLevel<T extends { id: string; levels?: LevelId[] }>(level: LevelId, list: T[]) {
  if (!levelChoices.find(choice => choice.id === level)?.playable) return []
  return list.filter(track => levelsFor(track).includes(level))
}
