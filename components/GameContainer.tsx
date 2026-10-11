import { useState, useEffect, useRef } from 'react'
import GameCanvas from './GameCanvas'
import GameUI, { formatTime } from './GameUI'
import { FrequencyFrontierGame, GameSnapshot } from '../lib/game-engine'
import { tracks, trackAudio, trackPage, musicLicense } from '../lib/music'

const initialSnapshot: GameSnapshot = {
  state: 'menu', score: 0, health: 100, mode: 'mid', combo: 0, multiplier: 1, progress: 0, duration: 0,
  bpm: 120, confidence: 0, feedback: '', countdown: 3, collected: 0, perfect: 0, missed: 0, bestCombo: 0,
  burst: false, levels: { bass: 0, mid: 0, high: 0 }
}

export default function GameContainer() {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [selectedId, setSelectedId] = useState(tracks[0].id)
  const [uploaded, setUploaded] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<'credits' | 'settings' | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState('Easy')
  const [volume, setVolume] = useState(0.65)
  const [intensity, setIntensity] = useState(0.65)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [timingOffset, setTimingOffset] = useState(0)
  const [bests, setBests] = useState<Record<string, number>>({})
  const gameRef = useRef<FrequencyFrontierGame | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLAudioElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const loadedKey = useRef('')
  const requestRef = useRef<AbortController | null>(null)
  const selected = tracks.find(track => track.id === selectedId) || tracks[0]
  const songKey = uploaded ? `upload:${uploaded.name}:${uploaded.size}` : selected.id
  const scoreKey = `${songKey}:${difficulty}`
  const title = uploaded ? uploaded.name.replace(/\.[^.]+$/, '') : selected.title

  useEffect(() => {
    const game = new FrequencyFrontierGame(canvasRef.current!)
    gameRef.current = game
    game.onUpdate = setSnapshot
    setReady(true)
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(preference.matches)
    const change = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', change)
    try { setBests(JSON.parse(localStorage.getItem('frequency-frontier-bests') || '{}')) } catch {}
    return () => {
      preference.removeEventListener('change', change)
      requestRef.current?.abort()
      game.dispose()
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    game.reducedMotion = reducedMotion
    game.intensity = intensity
    game.timingOffset = timingOffset
    game.audioProcessor.setVolume(volume)
    if (previewRef.current) previewRef.current.volume = volume
  }, [reducedMotion, intensity, timingOffset, volume, ready])

  useEffect(() => {
    if (snapshot.state !== 'complete' && snapshot.state !== 'gameOver') return
    setBests(previous => {
      if (snapshot.score <= (previous[scoreKey] || 0)) return previous
      const next = { ...previous, [scoreKey]: snapshot.score }
      try { localStorage.setItem('frequency-frontier-bests', JSON.stringify(next)) } catch {}
      return next
    })
  }, [snapshot.state, snapshot.score, scoreKey])

  useEffect(() => {
    if (dialog) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [dialog])

  const stopPreview = () => { previewRef.current?.pause(); setPreviewId(null) }
  const start = async () => {
    const game = gameRef.current
    if (!game || busy) return
    stopPreview()
    setBusy(true)
    setError('')
    const request = new AbortController()
    requestRef.current = request
    try {
      // Unlock in the click gesture before fetching or decoding a song.
      await game.unlockAudio()
      if (loadedKey.current !== songKey) {
        let data: ArrayBuffer
        if (uploaded) data = await uploaded.arrayBuffer()
        else {
          const response = await fetch(trackAudio(selected), { signal: request.signal })
          if (!response.ok) throw new Error('This song could not load. Run npm run music:download to restore the bundled tracks.')
          data = await response.arrayBuffer()
        }
        if (request.signal.aborted) return
        await game.audioProcessor.loadAudio(data, uploaded ? undefined : selected.bpm)
        if (request.signal.aborted) return
        loadedKey.current = songKey
      }
      game.audioProcessor.setVolume(volume)
      game.startGame(difficulty)
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load audio. Try a different audio file.')
    } finally { if (!request.signal.aborted) setBusy(false) }
  }

  const preview = async (id: string) => {
    if (previewId === id) { stopPreview(); return }
    const audio = previewRef.current
    if (!audio) return
    audio.pause()
    audio.src = trackAudio(tracks.find(track => track.id === id)!)
    audio.volume = volume
    setPreviewId(id)
    try { await audio.play() } catch { setPreviewId(null); setError('Preview could not play. Check that the bundled music is downloaded.') }
  }

  const upload = (file?: File) => {
    if (!file) return
    if (file.size > 40 * 1024 * 1024) { setError('Choose an audio file smaller than 40 MB.'); return }
    stopPreview()
    setError('')
    setUploaded(file)
    setDifficulty('Normal')
  }

  const openDialog = (name: 'credits' | 'settings') => {
    stopPreview()
    gameRef.current?.pauseGame()
    setDialog(name)
  }

  return <main className="frontier-shell">
    <GameCanvas ref={canvasRef} />
    <audio ref={previewRef} onEnded={() => setPreviewId(null)} onTimeUpdate={() => { if ((previewRef.current?.currentTime || 0) >= 20) stopPreview() }} preload="none" />
    {snapshot.state === 'menu' ? <div className="library-screen">
      <header className="library-header"><a className="wordmark" href="/">FF<span>FREQUENCY<br />FRONTIER</span></a><div className="header-actions"><span className="live-tag">A WORLD BUILT FROM SOUND</span><button className="text-button" onClick={() => openDialog('settings')}>Settings</button><button className="text-button" onClick={() => openDialog('credits')}>Music credits</button></div></header>
      <section className="library-layout">
        <div className="hero-panel">
          <span className="eyebrow">RHYTHM EXPLORATION / VOL. 01</span>
          <h1>Find your<br /><em>frequency.</em></h1>
          <p className="hero-copy">Ride a world of sound. Follow the beat, shift your frequency, and turn a good groove into a great run.</p>
          <div className="orbit-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="orbit-core">FF</div><span className="orbit-label">120 Hz — 6000 Hz</span></div>
          <div className="how-to"><span className="eyebrow">YOUR FIRST 30 SECONDS</span><p><b>01</b> Move with your mouse, touch, or WASD.</p><p><b>02</b> Match numbered shapes with modes 1 / 2 / 3.</p><p><b>03</b> Collect on the beat line. Dodge orange spikes, or phase through in bass.</p><small>Perfect combos earn multipliers. Every 16 matched hits triggers a healing resonance burst.</small></div>
        </div>
        <div className="soundtrack-panel">
          <div className="section-heading"><div><span className="eyebrow">PICK YOUR JOURNEY</span><h2>The soundtrack</h2></div><span className="track-count">12 FREE TRACKS</span></div>
          <div className="track-list" aria-label="Song library">
            {tracks.map((track, index) => <div key={track.id} className={`track-row ${!uploaded && selected.id === track.id ? 'active' : ''}`}>
              <button className="track-select" disabled={busy} aria-pressed={!uploaded && selected.id === track.id} onClick={() => { stopPreview(); setUploaded(null); setSelectedId(track.id); setDifficulty(track.difficulty); setError('') }}><span className={`track-art art-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span><span className="track-details"><strong>{track.title}</strong><small>{track.style} · Kevin MacLeod</small></span><span className="track-meta"><b>{track.bpm} BPM</b><small>{formatTime(track.duration)} · {track.difficulty}</small></span></button>
              <button className="preview-button" disabled={busy} onClick={() => preview(track.id)} aria-label={`${previewId === track.id ? 'Stop preview of' : 'Preview'} ${track.title}`}>{previewId === track.id ? '■' : '▶'}</button>
            </div>)}
          </div>
          <div className="upload-row"><button className="text-button" disabled={busy} onClick={() => fileRef.current?.click()}>＋ Bring your own music</button><span>{uploaded ? uploaded.name : 'Audio stays on your device'}</span><input ref={fileRef} type="file" accept="audio/*" hidden onChange={event => { upload(event.target.files?.[0]); event.target.value = '' }} /></div>
          <div className="launch-panel"><div className="selected-song"><span className="eyebrow">READY TO EXPLORE</span><strong>{title}</strong><small>{uploaded ? 'Automatic beat analysis' : `${selected.bpm} BPM${selected.bpm > 180 ? ' · half-time encounters' : ''}`} · Best: {(bests[scoreKey] || 0).toLocaleString()}</small></div><label className="difficulty-picker">Challenge<select value={difficulty} disabled={busy} onChange={event => setDifficulty(event.target.value)}><option>Easy</option><option>Normal</option><option>Hard</option></select></label><button className="primary-button launch-button" disabled={!ready || busy} onClick={start}>{busy ? 'Analyzing audio…' : 'Start exploring →'}</button></div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="license-note">Free with attribution · CC BY 4.0 · Music credits included</p>
        </div>
      </section>
    </div> : <GameUI snapshot={snapshot} title={title} best={bests[scoreKey] || 0} onPause={() => gameRef.current?.pauseGame()} onResume={() => { void gameRef.current?.resumeGame() }} onRestart={() => { void gameRef.current?.unlockAudio().then(() => gameRef.current?.restartGame()) }} onMenu={() => gameRef.current?.returnToMenu()} onSettings={() => openDialog('settings')} onMode={mode => gameRef.current?.setMode(mode)} />}
    <dialog ref={dialogRef} className="settings-dialog" aria-label={dialog === 'credits' ? 'Music credits' : 'Game settings'} onCancel={() => setDialog(null)} onClick={event => { if (event.target === event.currentTarget) setDialog(null) }}>
      <div className="dialog-header"><h2>{dialog === 'credits' ? 'Music credits' : 'Make it your own'}</h2><button className="small-button" onClick={() => setDialog(null)} autoFocus>Close</button></div>
      {dialog === 'credits' ? <div className="credits-content"><p>All bundled recordings by <a href="https://incompetech.com" target="_blank" rel="noreferrer">Kevin MacLeod (incompetech.com)</a>, licensed under <a href={musicLicense} target="_blank" rel="noreferrer">Creative Commons: By Attribution 4.0</a>.</p><p>Recordings are unmodified. Frequency Frontier generates synchronized gameplay and visuals from the audio. No artist endorsement is implied.</p><ul>{tracks.map(track => <li key={track.id}><a href={trackPage(track)} target="_blank" rel="noreferrer">“{track.title}”</a> — Kevin MacLeod · {track.isrc}</li>)}</ul></div> : <div className="settings-content"><label>Music volume <span>{Math.round(volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label><label>Visual intensity <span>{Math.round(intensity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={intensity} onChange={event => setIntensity(Number(event.target.value))} /></label><label className="checkbox-label"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /> Reduced motion</label><label>Timing offset <span>{timingOffset > 0 ? '+' : ''}{timingOffset} ms</span><input type="range" min="-200" max="200" step="10" value={timingOffset} onChange={event => setTimingOffset(Number(event.target.value))} /></label><p>Adjust until visual pulses feel aligned with the music. Positive values advance the visual and encounter timeline. Reduced motion removes grid scrolling, trails, expanding rings, and particles.</p>{snapshot.state !== 'menu' && <p>Close settings, then Resume to continue your run.</p>}</div>}
    </dialog>
  </main>
}
