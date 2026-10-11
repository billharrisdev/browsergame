import catalog from './tracks.json'

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
}
export const tracks = (catalog as Track[]).map(track => ({ ...track, artist: track.artist || 'Kevin MacLeod', collection: track.collection || 'original' }))
export const musicLicense = 'https://creativecommons.org/licenses/by/4.0/'
export const trackPage = (track: Track) => track.source || `https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}`
export const trackAudio = (track: Track) => `/music/${track.id}.mp3`
export const trackChart = (track: Track) => `/charts/${track.id}.json`
