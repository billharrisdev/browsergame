import catalog from './tracks.json'
import { songsForLevel as filterSongs, type LevelId } from './levels'

export type { LevelId } from './levels'
export { levelChoices, levelsFor, uploadLevels } from './levels'

export interface Track {
  id: string
  title: string
  bpm: number
  duration: number
  difficulty: string
  style: string
  artist?: string
  collection?: 'genres' | 'original'
  genre?: 'Rock' | 'Jazz' | 'Punk' | 'Metal'
  source?: string
  download?: string
  isrc?: string
  filename?: string
  beatOffset?: number
  beatsPerBar?: number
  meterVerified?: boolean
  tempoMap?: { startTime: number; bpm: number }[]
  levels?: LevelId[]
}
export const tracks = (catalog as Track[]).map(track => ({ ...track, artist: track.artist || 'Kevin MacLeod', collection: track.collection || 'original' as const }))
export function songsForLevel(level: LevelId, list: Track[] = tracks) {
  return filterSongs(level, list)
}
export const musicLicense = 'https://creativecommons.org/licenses/by/4.0/'
export const trackPage = (track: Track) => track.source || `https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}`
export const trackAudio = (track: Track) => `/music/${track.id}.mp3`
export const trackChart = (track: Track) => `/charts/${track.id}.json`
