import catalog from './tracks.json'

export const tracks = catalog
export type Track = typeof tracks[number]
export const musicLicense = 'https://creativecommons.org/licenses/by/4.0/'
export const trackPage = (track: Track) => `https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}`
export const trackAudio = (track: Track) => `/music/${track.id}.mp3`
