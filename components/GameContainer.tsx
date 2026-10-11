import { useState, useEffect, useRef } from 'react'
import GameCanvas from './GameCanvas'
import GameUI, { formatTime } from './GameUI'
import { FrequencyFrontierGame, initialSnapshot } from '../lib/game-engine'
import { tracks, trackAudio, trackChart, trackPage, musicLicense } from '../lib/music'

export default function GameContainer() {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [selectedId, setSelectedId] = useState(tracks[0].id)
  const [collection, setCollection] = useState('genres')
  const [genre, setGenre] = useState('All')
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
  const [metronome, setMetronome] = useState(false)
  const [bests, setBests] = useState<Record<string, number>>({})
  const gameRef = useRef<FrequencyFrontierGame | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLAudioElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const loadedKey = useRef('')
  const requestRef = useRef<AbortController | null>(null)
  const previewVersion = useRef(0)
  const selected = tracks.find(track => track.id === selectedId) || tracks[0]
  const songKey = uploaded ? `upload:${uploaded.name}:${uploaded.size}` : selected.id
  const scoreKey = `sticks-v3:${songKey}:${difficulty}`
  const title = uploaded ? uploaded.name.replace(/\.[^.]+$/, '') : selected.title
  const visibleTracks = tracks.filter(track => track.collection === collection && (genre === 'All' || track.genre === genre))

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
    try {
      const saved = JSON.parse(localStorage.getItem('frequency-frontier-timing') || '{}')
      setTimingOffset(Math.max(-200, Math.min(200, Number(saved.offset) || 0)))
      setMetronome(saved.metronome === true)
    } catch {}
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
    game.audioProcessor.setMetronome(metronome, timingOffset)
    if (ready) { try { localStorage.setItem('frequency-frontier-timing', JSON.stringify({ offset: timingOffset, metronome })) } catch {} }
    game.audioProcessor.setVolume(volume)
    if (previewRef.current) previewRef.current.volume = volume
  }, [reducedMotion, intensity, timingOffset, volume, metronome, ready])

  useEffect(() => {
    if (snapshot.state !== 'complete') return
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

  const stopPreview = () => { previewVersion.current++; previewRef.current?.pause(); setPreviewId(null) }
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
        let chart
        if (uploaded) data = await uploaded.arrayBuffer()
        else {
          const [response, chartResponse] = await Promise.all([
            fetch(trackAudio(selected), { signal: request.signal }),
            fetch(trackChart(selected), { signal: request.signal })
          ])
          if (!response.ok) throw new Error('This song could not load. Run npm run music:download to restore the bundled tracks.')
          if (!chartResponse.ok) throw new Error('This song’s chart is missing. Run npm run music:charts to rebuild it.')
          data = await response.arrayBuffer()
          chart = await chartResponse.json()
        }
        if (request.signal.aborted) return
        await game.audioProcessor.loadAudio(data, uploaded ? undefined : selected.bpm, chart)
        if (request.signal.aborted) return
        loadedKey.current = songKey
      }
      game.audioProcessor.setVolume(volume)
      await game.startGame(difficulty)
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load audio. Try a different audio file.')
    } finally { if (!request.signal.aborted) setBusy(false) }
  }

  const preview = async (id: string) => {
    if (previewId === id) { stopPreview(); return }
    const audio = previewRef.current
    if (!audio) return
    audio.pause()
    const version = ++previewVersion.current
    audio.src = trackAudio(tracks.find(track => track.id === id)!)
    audio.volume = volume
    setPreviewId(id)
    try { await audio.play() } catch { if (version === previewVersion.current) { setPreviewId(null); setError('Preview could not play. Check that the bundled music is downloaded.') } }
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

  const chooseCollection = (next: string) => {
    stopPreview()
    setCollection(next)
    setGenre('All')
    const first = tracks.find(track => track.collection === next)!
    setSelectedId(first.id)
    setDifficulty(first.difficulty)
    setUploaded(null)
    setError('')
  }

  const chooseGenre = (next: string) => {
    stopPreview()
    setGenre(next)
    if (next !== 'All' && (selected.genre !== next || uploaded)) {
      const first = tracks.find(track => track.genre === next)!
      setSelectedId(first.id)
      setDifficulty(first.difficulty)
      setUploaded(null)
      setError('')
    }
  }

  return <main className="frontier-shell">
    <GameCanvas ref={canvasRef} />
    <audio ref={previewRef} onEnded={() => setPreviewId(null)} onTimeUpdate={() => { if ((previewRef.current?.currentTime || 0) >= 20) stopPreview() }} preload="none" />
    {snapshot.state === 'menu' ? <div className="library-screen">
      <header className="library-header"><a className="wordmark" href="/">FF<span>FREQUENCY<br />FRONTIER</span></a><div className="header-actions"><span className="live-tag">A WORLD BUILT FROM SOUND</span><button className="text-button" onClick={() => openDialog('settings')}>Settings</button><button className="text-button" onClick={() => openDialog('credits')}>Music credits</button></div></header>
      <section className="library-layout">
        <div className="hero-panel">
          <span className="eyebrow">POINT. CLICK. FIND THE POCKET.</span>
          <h1>Feel it.<br /><em>Hit the beat.</em></h1>
          <p className="hero-copy">A target. A shrinking ring. One perfect moment. Click or tap in time with the music and find your rhythm.</p>
          <div className="orbit-art target-art" aria-hidden="true"><div className="demo-approach" /><div className="orbit-core">1</div><span className="orbit-label">WAIT FOR THE RING. THEN CLICK.</span></div>
          <div className="how-to"><span className="eyebrow">YOUR FIRST FOUR BEATS</span><p><b>01</b> Listen to the count-in and follow the corner beat counter.</p><p><b>02</b> Aim + left/right click, or strike the next target with Left/Right Ctrl.</p><p><b>03</b> Level 2: R L R R · L R L L in eighths. Level 3: sixteenths.</p><small>Perfect and Close hits with the correct stick build combos. Turn on the beat click to check alignment; adjust timing offset in Settings.</small></div>
        </div>
        <div className="soundtrack-panel">
          <div className="section-heading"><div><span className="eyebrow">PICK YOUR SOUND</span><h2>The soundtrack</h2></div><span className="track-count">24 FREE TRACKS</span></div>
          <div className="collection-tabs" aria-label="Soundtrack collections"><button disabled={busy} className={collection === 'genres' ? 'active' : ''} aria-pressed={collection === 'genres'} onClick={() => chooseCollection('genres')}>Genre Collection <small>12 new songs</small></button><button disabled={busy} className={collection === 'original' ? 'active' : ''} aria-pressed={collection === 'original'} onClick={() => chooseCollection('original')}>Original Mix <small>12 original songs</small></button></div>
          {collection === 'genres' && <div className="genre-filters" aria-label="Genre filters">{['All', 'Rock', 'Jazz', 'Punk', 'Metal'].map(value => <button key={value} disabled={busy} className={genre === value ? 'active' : ''} aria-pressed={genre === value} onClick={() => chooseGenre(value)}>{value}</button>)}</div>}
          <div className="track-list" aria-label="Song library">
            {visibleTracks.map((track, index) => <div key={track.id} className={`track-row ${!uploaded && selected.id === track.id ? 'active' : ''}`}>
              <button className="track-select" disabled={busy} aria-pressed={!uploaded && selected.id === track.id} onClick={() => { stopPreview(); setUploaded(null); setSelectedId(track.id); setDifficulty(track.difficulty); setError('') }}><span className={`track-art art-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span><span className="track-details"><strong>{track.title}</strong><small>{track.genre || track.style} · {track.artist}</small></span><span className="track-meta"><b>{track.bpm ? `${Math.round(track.bpm)} BPM` : 'AUTO TEMPO'}</b><small>{formatTime(track.duration)} · {track.difficulty}</small></span></button>
              <button className="preview-button" disabled={busy} onClick={() => preview(track.id)} aria-label={`${previewId === track.id ? 'Stop preview of' : 'Preview'} ${track.title}`}>{previewId === track.id ? '■' : '▶'}</button>
            </div>)}
          </div>
          <div className="upload-row"><button className="text-button" disabled={busy} onClick={() => fileRef.current?.click()}>＋ Bring your own music</button><span>{uploaded ? uploaded.name : 'Audio stays on your device'}</span><input ref={fileRef} type="file" accept="audio/*" hidden onChange={event => { upload(event.target.files?.[0]); event.target.value = '' }} /></div>
          <div className="launch-panel"><div className="selected-song"><span className="eyebrow">READY TO FIND THE POCKET</span><strong>{title}</strong><small>{uploaded ? 'Generated pulse grid' : 'Stored pulse grid'} · Best: {(bests[scoreKey] || 0).toLocaleString()}</small></div><label className="difficulty-picker">Level<select value={difficulty} disabled={busy} onChange={event => setDifficulty(event.target.value)}><option value="Easy">1 · Pulse</option><option value="Normal">2 · Eighths</option><option value="Hard">3 · Sixteenths</option></select></label><button className="primary-button launch-button" disabled={!ready || busy} onClick={start}>{busy ? 'Preparing your song…' : 'Play the beat →'}</button></div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="license-note">Free with attribution · CC BY 4.0 · Music credits included</p>
        </div>
      </section>
    </div> : <GameUI snapshot={snapshot} title={title} generated={!!uploaded} best={bests[scoreKey] || 0} metronome={metronome} onMetronome={() => setMetronome(previous => !previous)} onStick={(hand, stamp) => gameRef.current?.strikeStick(hand, stamp)} onHit={(x, y, stamp, hand) => gameRef.current?.clickAt(x, y, stamp, hand)} onPause={() => gameRef.current?.pauseGame()} onResume={() => { void gameRef.current?.resumeGame() }} onRestart={() => { void gameRef.current?.restartGame().catch(() => setError('Audio could not restart. Try loading the song again.')) }} onMenu={() => gameRef.current?.returnToMenu()} onSettings={() => openDialog('settings')} />}
    <dialog ref={dialogRef} className="settings-dialog" aria-label={dialog === 'credits' ? 'Music credits' : 'Game settings'} onCancel={() => setDialog(null)} onClick={event => { if (event.target === event.currentTarget) setDialog(null) }}>
      <div className="dialog-header"><h2>{dialog === 'credits' ? 'Music credits' : 'Make it your own'}</h2><button className="small-button" onClick={() => setDialog(null)} autoFocus>Close</button></div>
      {dialog === 'settings' && <label className="metronome-setting"><input type="checkbox" checked={metronome} onChange={event => setMetronome(event.target.checked)} /> Beat click / metronome</label>}
      {dialog === 'credits' && <p className="credit-notice">Eyesplit © 2016 by Shane Ivers. Music: Eyesplit by Shane Ivers — silvermansound.com.</p>}
      {dialog === 'credits' ? <div className="credits-content"><p>All recordings licensed under <a href={musicLicense} target="_blank" rel="noreferrer">Creative Commons: By Attribution 4.0</a>. Music by <a href="https://audionautix.com" target="_blank" rel="noreferrer">Jason Shaw / Audionautix.com</a>, <a href="https://www.silvermansound.com" target="_blank" rel="noreferrer">Shane Ivers / Silverman Sound</a>, and <a href="https://incompetech.com" target="_blank" rel="noreferrer">Kevin MacLeod / Incompetech</a>, with Alexander Nakarada featured on Feral Angel Waltz.</p><p>Recordings are unmodified. The game generates synchronized targets and visuals. No artist endorsement is implied.</p><ul>{tracks.map(track => <li key={track.id}><a href={trackPage(track)} target="_blank" rel="noreferrer">“{track.title}”</a> — {track.artist}{track.isrc ? ` · ${track.isrc}` : ''} · CC BY 4.0</li>)}</ul></div> : <div className="settings-content"><label>Music volume <span>{Math.round(volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label><label>Visual intensity <span>{Math.round(intensity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={intensity} onChange={event => setIntensity(Number(event.target.value))} /></label><label className="checkbox-label"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /> Reduced motion</label><label>Timing offset <span>{timingOffset > 0 ? '+' : ''}{timingOffset} ms</span><input type="range" min="-200" max="200" step="10" value={timingOffset} onChange={event => setTimingOffset(Number(event.target.value))} /></label><p>Automatic output-latency compensation is active. Positive offset advances targets and judges taps later; negative offset moves targets back and judges taps earlier. Adjust until ring closure matches the audible beat.</p><p>Reduced motion removes decorative flashes and hit expansions. Approach rings stay visible because they are the timing cue.</p>{snapshot.state !== 'menu' && <p>Close settings, then Resume to continue your run.</p>}</div>}
    </dialog>
  </main>
}
