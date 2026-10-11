import { GameSnapshot } from '../lib/game-engine'
import { FrequencyMode } from '../lib/game-engine/player'

export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

interface GameUIProps {
  snapshot: GameSnapshot
  title: string
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
  onSettings: () => void
  onMode: (mode: FrequencyMode) => void
  best: number
}

export default function GameUI({ snapshot: s, title, onPause, onResume, onRestart, onMenu, onSettings, onMode, best }: GameUIProps) {
  const finished = s.state === 'complete' || s.state === 'gameOver'
  const accuracy = s.collected + s.missed ? Math.round(s.collected / (s.collected + s.missed) * 100) : 0
  const rank = accuracy >= 95 ? 'S' : accuracy >= 80 ? 'A' : accuracy >= 65 ? 'B' : 'C'
  return <>
    <header className="play-hud">
      <div className="now-playing"><span className="eyebrow">NOW EXPLORING · {Math.round(s.bpm)} BPM{s.confidence < 0.25 ? ' · ESTIMATED BEAT' : ''}</span><strong>{title}</strong></div>
      <div className="hud-stat"><span>SCORE</span><strong>{s.score.toLocaleString()}</strong></div>
      <div className="hud-stat"><span>COMBO</span><strong className="mint">{s.combo} <small>×{s.multiplier}</small></strong></div>
      <div className="health-stat"><span>INTEGRITY {s.health}%</span><div className="health-track"><i style={{ width: `${s.health}%` }} /></div></div>
      <button className="small-button" onClick={onSettings} aria-label="Open settings">Settings</button>
      <button className="small-button" onClick={s.state === 'paused' ? onResume : onPause} disabled={finished}>{s.state === 'paused' ? 'Resume' : 'Pause'}</button>
    </header>
    <div className="song-progress" role="progressbar" aria-label="Song progress" aria-valuemin={0} aria-valuemax={Math.round(s.duration)} aria-valuenow={Math.round(s.progress)}><i style={{ width: `${s.duration ? s.progress / s.duration * 100 : 0}%` }} /></div>
    <div className={`timing-feedback ${s.burst ? 'resonating' : ''}`}>{s.burst ? 'RESONANCE · DOUBLE POINTS' : s.feedback}</div>
    <footer className="play-footer">
      <div className="time-display">{formatTime(s.progress)} <span>/ {formatTime(s.duration)}</span></div>
      <div className="mode-controls" aria-label="Frequency mode">
        {(['bass', 'mid', 'high'] as const).map((mode, index) => <button key={mode} className={`mode-button ${mode} ${s.mode === mode ? 'selected' : ''}`} onClick={() => onMode(mode)} aria-pressed={s.mode === mode}><kbd>{index + 1}</kbd><span>{mode.toUpperCase()}<small>{index === 0 ? 'Phase' : index === 1 ? 'Balance' : 'Speed'}</small></span></button>)}
      </div>
      <div className="play-help">Move: mouse / touch / WASD<br />Match shapes · Space to pause</div>
    </footer>
    {s.state === 'countdown' && <div className="countdown-overlay"><span>FIND YOUR FREQUENCY</span><strong>{s.countdown || 'GO'}</strong><p>Start on the beat line. Follow the numbered shapes.</p></div>}
    {s.state === 'paused' && <div className="game-overlay"><section className="overlay-card"><span className="eyebrow">TAKE A BREATHER</span><h2>Paused</h2><p>Your song and musical timeline are paused together.</p><div className="button-row"><button className="primary-button" onClick={onResume}>Resume exploration</button><button className="secondary-button" onClick={onMenu}>Song library</button></div></section></div>}
    {finished && <div className="game-overlay"><section className="overlay-card results"><span className="eyebrow">{s.state === 'complete' ? 'SONG COMPLETE' : 'SIGNAL LOST'}</span><h2>{s.state === 'complete' ? 'Beautiful resonance.' : 'Find your rhythm.'}</h2><div className="result-score"><strong>{s.score.toLocaleString()}</strong>{s.state === 'complete' && <span className="rank">{rank}</span>}</div><div className="result-stats"><div><strong>{s.perfect}</strong><span>Perfect hits</span></div><div><strong>{s.bestCombo}</strong><span>Best combo</span></div><div><strong>{accuracy}%</strong><span>Collected</span></div></div><p>Personal best: {best.toLocaleString()} · Match modes and collect on the beat line to build combos.</p><div className="button-row"><button className="primary-button" onClick={onRestart}>Play again</button><button className="secondary-button" onClick={onMenu}>Choose a song</button></div></section></div>}
  </>
}
