import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const source = await readFile(new URL('lib/game-engine/rhythm.ts', root), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const { buildSongChart } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
const tracks = JSON.parse(await readFile(new URL('lib/music/tracks.json', root), 'utf8'))
await mkdir(new URL('public/charts/', root), { recursive: true })
for (const track of tracks) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', fileURLToPath(new URL(`public/music/${track.id}.mp3`, root)), '-ac', '1', '-ar', '22050', '-f', 'f32le', 'pipe:1'], { maxBuffer: 160 * 1024 * 1024 })
  const samples = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength))
  const chart = buildSongChart(samples, 22050, track.tempoSource === 'analysis' ? undefined : track.bpm || undefined, {
    offset: track.beatOffset, beatsPerBar: track.beatsPerBar, meterVerified: track.meterVerified, tempoMap: track.tempoMap
  })
  chart.provenance = 'Stable musical pulse with fractional tempo/phase fit. Attacks diagnose alignment and active measures; beats are not snapped to attacks. Not listening-verified.'
  if (!track.bpm || track.tempoSource === 'analysis') { track.bpm = chart.bpm; track.tempoSource = 'analysis' }
  track.duration = Math.round(chart.duration)
  await writeFile(new URL(`public/charts/${track.id}.json`, root), JSON.stringify(chart))
  console.log(`${track.title}: ${chart.bpm} BPM, ${chart.notes.length} active beats; residual ms beginning/middle/end: ${chart.alignment.map(section => section.meanResidualMs).join('/')}`)
}
await writeFile(new URL('lib/music/tracks.json', root), JSON.stringify(tracks, null, 2) + '\n')
