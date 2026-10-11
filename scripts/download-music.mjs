import { readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const tracks = JSON.parse(await readFile(new URL('lib/music/tracks.json', root), 'utf8'))
const folder = new URL('public/music/', root)
await mkdir(folder, { recursive: true })
for (const track of tracks) {
  const destination = new URL(`${track.id}.mp3`, folder)
  try { if ((await stat(destination)).size > 1000) { console.log(`Already downloaded: ${track.title}`); continue } } catch {}
  const url = `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(track.filename)}`
  let data
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) })
      if (!response.ok) throw new Error(`${track.title}: HTTP ${response.status}`)
      data = Buffer.from(await response.arrayBuffer())
      if (data.length < 1000 || response.headers.get('content-type')?.includes('text/html')) throw new Error(`Invalid audio: ${track.title}`)
      break
    } catch (error) {
      if (attempt === 2) throw error
      console.log(`Retrying ${track.title}…`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  await writeFile(destination, data)
  console.log(`Downloaded ${track.title}: ${(data.length / 1024 / 1024).toFixed(1)} MB`)
}
console.log(`Music ready in ${fileURLToPath(folder)}. See MUSIC_CREDITS.md for attribution.`)
