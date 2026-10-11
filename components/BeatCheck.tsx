import { useEffect, useRef, useState } from 'react'
import { checkClicks, checkGrids, CheckGrid, heardBpm } from '../lib/game-engine/beatCheck'
import { beatPosition } from '../lib/game-engine/rhythm'
import { trackAudio, trackChart, Track } from '../lib/music'
import { formatTime } from './GameUI'

export default function BeatCheck({ track, onClose }: { track: Track; onClose: () => void }) {
  const [grid, setGrid] = useState<CheckGrid>('pulse')
  const [click, setClick] = useState(true)
  const [nudge, setNudge] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(track.duration)
  const [bpm, setBpm] = useState(track.bpm)
  const [beat, setBeat] = useState(0)
  const [flash, setFlash] = useState(0)
  const [error, setError] = useState('')
  const audio = useRef<AudioContext | null>(null)
  const gain = useRef<GainNode | null>(null)
  const buffer = useRef<AudioBuffer | null>(null)
  const source = useRef<AudioBufferSourceNode | null>(null)
  const clicks = useRef<{ time: number; accent: boolean }[]>([])
  const scheduled = useRef<OscillatorNode[]>([])
  const cursor = useRef(0)
  const startedAt = useRef(0)
  const offset = useRef(0)
  const playingRef = useRef(false)
  const nudgeRef = useRef(0)
  const clickRef = useRef(true)
  const beats = useRef<number[]>([])
  const meter = useRef(4)

  const songTime = () => playingRef.current && audio.current ? Math.min(buffer.current?.duration || 0, offset.current + audio.current.currentTime - startedAt.current) : offset.current

  const clearClicks = () => {
    for (const node of scheduled.current) { try { node.stop() } catch { /* already stopped */ } }
    scheduled.current = []
  }
  const pump = () => {
    const context = audio.current
    if (!context || !playingRef.current || !clickRef.current) return
    const now = context.currentTime
    while (cursor.current < clicks.current.length) {
      const hit = clicks.current[cursor.current]
      const at = startedAt.current + hit.time + nudgeRef.current - offset.current
      if (at > now + 0.25) break
      cursor.current++
      if (at < now + 0.001) continue
      const oscillator = context.createOscillator()
      const clickGain = context.createGain()
      oscillator.frequency.value = hit.accent ? 1180 : 760
      clickGain.gain.setValueAtTime(hit.accent ? 0.16 : 0.08, at)
      clickGain.gain.exponentialRampToValueAtTime(0.001, at + 0.04)
      oscillator.connect(clickGain); clickGain.connect(gain.current!)
      oscillator.start(at); oscillator.stop(at + 0.05)
      scheduled.current.push(oscillator)
      oscillator.onended = () => { oscillator.disconnect(); clickGain.disconnect() }
    }
  }
  const armClicks = () => {
    clearClicks()
    const heard = songTime() + 0.02
    cursor.current = clicks.current.findIndex(hit => hit.time + nudgeRef.current >= heard)
    if (cursor.current < 0) cursor.current = clicks.current.length
    pump()
  }
  const stopSource = () => {
    offset.current = songTime()
    playingRef.current = false
    clearClicks()
    if (source.current) { source.current.onended = null; try { source.current.stop() } catch { /* already stopped */ } source.current.disconnect(); source.current = null }
  }
  const startSource = async () => {
    const context = audio.current
    if (!context || !buffer.current || playingRef.current) return
    await context.resume()
    if (offset.current >= buffer.current.duration - 0.05) offset.current = 0
    const node = context.createBufferSource()
    node.buffer = buffer.current
    node.connect(gain.current!)
    source.current = node
    startedAt.current = context.currentTime
    playingRef.current = true
    node.onended = () => { if (source.current !== node) return; offset.current = buffer.current?.duration || 0; playingRef.current = false; clearClicks(); setPlaying(false) }
    node.start(0, offset.current)
    armClicks()
    setPlaying(true)
  }

  useEffect(() => {
    const context = new AudioContext()
    const output = context.createGain()
    output.gain.value = 0.7
    output.connect(context.destination)
    audio.current = context
    gain.current = output
    let cancelled = false
    ;(async () => {
      try {
        const [audioResponse, chartResponse] = await Promise.all([fetch(trackAudio(track)), fetch(trackChart(track))])
        if (!audioResponse.ok || !chartResponse.ok) throw new Error('This song or its chart could not load.')
        const decoded = await context.decodeAudioData(await audioResponse.arrayBuffer())
        const chart = await chartResponse.json()
        if (cancelled) return
        buffer.current = decoded
        beats.current = chart.beats || []
        meter.current = chart.beatsPerBar || 4
        setBpm(chart.bpm || track.bpm)
        setDuration(decoded.duration)
        clicks.current = checkClicks(beats.current, meter.current, 'pulse')
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to check this beat.') }
    })()
    const frame = window.setInterval(() => {
      const current = songTime()
      setTime(current)
      const position = beatPosition(current, { bpm, offset: beats.current[0] || 0, beats: beats.current, confidence: 1 }, 1)
      setBeat(position.total)
      const nearest = clicks.current.reduce((best, hit) => Math.abs(hit.time + nudgeRef.current - current) < Math.abs(best - current) ? hit.time + nudgeRef.current : best, 99)
      setFlash(Math.max(0, 1 - Math.abs(nearest - current) / 0.12))
      pump()
    }, 50)
    return () => { cancelled = true; window.clearInterval(frame); stopSource(); void context.close() }
  }, [track])

  useEffect(() => {
    clicks.current = checkClicks(beats.current, meter.current, grid)
    nudgeRef.current = nudge / 1000
    clickRef.current = click
    armClicks()
  }, [grid, nudge, click])

  return <div className="game-overlay beat-check" role="dialog" aria-label={`Beat check for ${track.title}`}>
    <section className={`overlay-card beat-check-card ${flash > 0.45 ? 'flashing' : ''}`}>
      <div className="dialog-header"><div><span className="eyebrow">DEBUG · ESTIMATED GRID</span><h2>{track.title}</h2></div><button className="small-button" onClick={onClose}>Close</button></div>
      <div className="beat-check-readout" aria-live="polite"><strong style={{ opacity: 0.45 + flash * 0.55 }}>{beat || '—'}</strong><span>{Math.round(heardBpm(bpm, grid))} BPM heard · {Math.round(bpm)} chart · {checkGrids.find(item => item.id === grid)?.label}</span></div>
      <input aria-label="Song position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(time, duration || 0)} onChange={event => { const next = Number(event.target.value); const was = playingRef.current; stopSource(); offset.current = next; setTime(next); if (was) void startSource() }} />
      <div className="beat-check-tools"><span>{formatTime(time)} / {formatTime(duration)}</span><button className="primary-button" onClick={() => playing ? (stopSource(), setPlaying(false)) : void startSource()}>{playing ? 'Pause' : 'Play song'}</button><button className="secondary-button" aria-pressed={click} onClick={() => setClick(value => !value)}>{click ? 'Click on' : 'Click off'}</button></div>
      <div className="genre-filters" aria-label="Beat interpretations">{checkGrids.map(item => <button key={item.id} className={grid === item.id ? 'active' : ''} aria-pressed={grid === item.id} onClick={() => setGrid(item.id)}>{item.label}</button>)}</div>
      <label className="beat-nudge">Click nudge <span>{nudge > 0 ? '+' : ''}{nudge} ms</span><input type="range" min="-100" max="100" step="10" value={nudge} onChange={event => setNudge(Number(event.target.value))} /></label>
      <p>Nothing here is saved. Positive nudge makes the click later. Compare the click with the drums, then close and tell me which interpretation matches.</p>
      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  </div>
}
