import { useEffect, useRef, useState } from 'react'
import { beatResiduals, checkClicks, checkGrids, CheckGrid, clickPhase, heardBpm } from '../lib/game-engine/beatCheck'
import { beatPosition } from '../lib/game-engine/rhythm'
import { trackAudio, trackChart, Track } from '../lib/music'
import { formatTime } from './GameUI'

export default function BeatCheck({ track, onClose }: { track: Track; onClose: () => void }) {
  const [grid, setGrid] = useState<CheckGrid>('pulse')
  const [click, setClick] = useState(true)
  const [nudge, setNudge] = useState(0)
  const [mix, setMix] = useState(0.4)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(track.duration)
  const [bpm, setBpm] = useState(track.bpm)
  const [beat, setBeat] = useState(0)
  const [flash, setFlash] = useState(0)
  const [phase, setPhase] = useState(0)
  const [barBeat, setBarBeat] = useState(0)
  const [chartBeats, setChartBeats] = useState<number[]>([])
  const [residuals, setResiduals] = useState<{ time: number; residualMs: number | null }[]>([])
  const [bars, setBars] = useState(4)
  const [error, setError] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const audio = useRef<AudioContext | null>(null)
  const gain = useRef<GainNode | null>(null)
  const songGain = useRef<GainNode | null>(null)
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
    node.connect(songGain.current!)
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
    const music = context.createGain()
    music.gain.value = 0.4
    music.connect(output)
    output.connect(context.destination)
    audio.current = context
    gain.current = output
    songGain.current = music
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
        setChartBeats(beats.current)
        setBars(meter.current)
        setResiduals(beatResiduals(beats.current, chart.attacks || []))
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
      setBarBeat(position.beat)
      setPhase(clickPhase(clicks.current, current - nudgeRef.current).phase)
      const nearest = clicks.current.reduce((best, hit) => Math.abs(hit.time + nudgeRef.current - current) < Math.abs(best - current) ? hit.time + nudgeRef.current : best, 99)
      setFlash(Math.max(0, 1 - Math.abs(nearest - current) / 0.12))
      pump()
    }, 50)
    return () => { cancelled = true; window.clearInterval(frame); stopSource(); void context.close() }
  }, [track])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (songGain.current) songGain.current.gain.value = mix
  }, [mix])

  useEffect(() => {
    clicks.current = checkClicks(beats.current, meter.current, grid)
    nudgeRef.current = nudge / 1000
    clickRef.current = click
    armClicks()
  }, [grid, nudge, click])

  useEffect(() => {
    gridRef.current?.querySelector('.is-now')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [beat])

  const seek = (next: number) => {
    const was = playingRef.current
    stopSource()
    offset.current = next
    setTime(next)
    if (was) void startSource()
  }
  const ring = 2 * Math.PI * 62
  const rows = []
  for (let index = 0; index < residuals.length; index += bars) rows.push(residuals.slice(index, index + bars))

  return <div className="game-overlay beat-check" role="dialog" aria-label={`Beat check for ${track.title}`}>
    <section className={`overlay-card beat-check-card ${flash > 0.45 ? 'flashing' : ''}`}>
      <div className="dialog-header"><div><span className="eyebrow">DEBUG · ESTIMATED GRID</span><h2>{track.title}</h2></div><button className="small-button" onClick={onClose} autoFocus>Close</button></div>
      <div className="beat-check-body">
      <div className="beat-check-readout" aria-live="polite">
        <svg className="beat-ring" viewBox="0 0 160 160" role="img" aria-label={`Beat ${barBeat || 'not started'}, phase ${Math.round(phase * 100)} percent`}>
          <circle cx="80" cy="80" r="62" fill="none" stroke="#24384c" strokeWidth="8" />
          <circle cx="80" cy="80" r="62" fill="none" stroke="#5df3d1" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${phase * ring} ${ring}`} transform="rotate(-90 80 80)" opacity={0.45 + flash * 0.55} />
          <circle cx="80" cy="80" r={54 + flash * 8} fill="none" stroke="#5df3d1" strokeWidth="2" opacity={flash} />
          {Array.from({ length: bars }, (_, index) => <circle key={index} cx={80 + Math.sin(index / bars * Math.PI * 2) * 74} cy={80 - Math.cos(index / bars * Math.PI * 2) * 74} r={index === 0 ? 3.5 : 2} fill={index + 1 === barBeat ? '#5df3d1' : '#6d879e'} />)}
          <text x="80" y="76" textAnchor="middle" fill="#5df3d1" fontSize="36" fontFamily="monospace">{barBeat || '—'}</text>
          <text x="80" y="98" textAnchor="middle" fill="#8eabc0" fontSize="11" fontFamily="monospace">{beat ? `BEAT ${beat}` : 'READY'}</text>
        </svg>
        <span>{Math.round(heardBpm(bpm, grid))} BPM heard · {Math.round(bpm)} chart · {checkGrids.find(item => item.id === grid)?.label}<br />The ring completes once per heard click. Bar dots mark the detected measure.</span>
      </div>
      <input aria-label="Song position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(time, duration || 0)} onChange={event => seek(Number(event.target.value))} />
      <div className="beat-check-tools"><span>{formatTime(time)} / {formatTime(duration)}</span><button className="primary-button" onClick={() => playing ? (stopSource(), setPlaying(false)) : void startSource()}>{playing ? 'Pause' : 'Play song'}</button><button className="secondary-button" aria-pressed={click} onClick={() => setClick(value => !value)}>{click ? 'Click on' : 'Click off'}</button></div>
      <div className="genre-filters" aria-label="Beat interpretations">{checkGrids.map(item => <button key={item.id} className={grid === item.id ? 'active' : ''} aria-pressed={grid === item.id} onClick={() => setGrid(item.id)}>{item.label}</button>)}</div>
      <label className="beat-nudge">Song mix <span>{Math.round(mix * 100)}%</span><input aria-label="Recorded audio mix" type="range" min="0" max="1" step="0.05" value={mix} onChange={event => setMix(Number(event.target.value))} /></label>
      <label className="beat-nudge">Click nudge <span>{nudge > 0 ? '+' : ''}{nudge} ms</span><input type="range" min="-100" max="100" step="10" value={nudge} onChange={event => setNudge(Number(event.target.value))} /></label>
      <div className="timing-grid" ref={gridRef} aria-label="Detected beats arranged by bar">
        <div className="timing-row timing-head" style={{ gridTemplateColumns: `42px repeat(${bars}, 1fr)` }}>{['Bar', ...Array.from({ length: bars }, (_, index) => index + 1)].map(label => <span key={label}>{label}</span>)}</div>
        {rows.map((row, rowIndex) => <div key={rowIndex} className="timing-row" style={{ gridTemplateColumns: `42px repeat(${bars}, 1fr)` }}>
          <span>{rowIndex + 1}</span>
          {row.map((cell, column) => {
            const index = rowIndex * bars + column
            const late = (cell.residualMs || 0) > 20
            const early = (cell.residualMs || 0) < -20
            return <button key={cell.time} className={`timing-cell ${index + 1 === beat ? 'is-now' : ''} ${cell.residualMs === null ? 'missing' : late ? 'late' : early ? 'early' : 'locked'}`} title={cell.residualMs === null ? 'No nearby attack' : `${cell.residualMs} ms`} onClick={() => seek(cell.time)}>{cell.residualMs === null ? '·' : cell.residualMs}</button>
          })}
        </div>)}
      </div>
      <p className="timing-legend"><i className="locked" /> within 20 ms <i className="early" /> early <i className="late" /> late <i className="missing" /> no attack. Click a cell to jump there.</p>
      <p>Nothing here is saved. Positive nudge makes the click later. Compare the click with the drums, then close and tell me which interpretation matches.</p>
      {error && <p className="error-message" role="alert">{error}</p>}
      </div>
    </section>
  </div>
}
