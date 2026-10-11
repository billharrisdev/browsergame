import { GameSnapshot, judgmentColors } from '../lib/game-engine'
import { describeTiming } from '../lib/game-engine/rhythm'

export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

interface GameUIProps {
  snapshot: GameSnapshot
  title: string
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
  onSettings: () => void
  best: number
  generated: boolean
  onHit: (x: number, y: number, stamp: number) => void
}

export default function GameUI({ snapshot: s, title, onPause, onResume, onRestart, onMenu, onSettings, best, generated, onHit }: GameUIProps) {
  const finished = s.state === 'complete'
  const rank = s.accuracy >= 95 ? 'S' : s.accuracy >= 80 ? 'A' : s.accuracy >= 65 ? 'B' : 'C'
  const feedback = s.feedback
  const error = feedback?.errorMs
  return <>
    {s.state === 'playing' && <div className="target-input-layer">{s.targets.map(target => <button key={target.id} className="target-input" aria-label={`Beat ${target.id}`} style={{ left: target.x - target.radius, top: target.y - target.radius, width: target.radius * 2, height: target.radius * 2 }} onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return
      event.preventDefault()
      onHit(event.clientX, event.clientY, event.timeStamp)
    }} onClick={event => {
      if (event.detail === 0) onHit(target.x, target.y, performance.now())
    }} />)}</div>}
    <header className="play-hud">
      <div className="now-playing"><span className="eyebrow">CLICK THE BEAT · {Math.round(s.bpm)} BPM{generated ? ' · GENERATED CHART' : ''}</span><strong>{title}</strong></div>
      <div className="hud-stat"><span>SCORE</span><strong>{s.score.toLocaleString()}</strong></div>
      <div className="hud-stat"><span>COMBO</span><strong className="mint">{s.combo} <small>×{s.multiplier}</small></strong></div>
      <div className="hud-stat accuracy-stat"><span>ACCURACY</span><strong>{s.accuracy.toFixed(1)}<small>%</small></strong></div>
      <button className="small-button" onClick={onSettings} aria-label="Open settings">Settings</button>
      <button className="small-button" onClick={s.state === 'paused' ? onResume : onPause} disabled={finished}>{s.state === 'paused' ? 'Resume' : 'Pause'}</button>
    </header>
    <div className="song-progress" role="progressbar" aria-label="Song progress" aria-valuemin={0} aria-valuemax={Math.round(s.duration)} aria-valuenow={Math.round(s.progress)}><i style={{ width: `${s.duration ? s.progress / s.duration * 100 : 0}%` }} /></div>
    <div className="timing-feedback" role="status" aria-live="polite" style={{ color: feedback ? judgmentColors[feedback.grade] : undefined }}>{feedback ? describeTiming(feedback.grade, feedback.errorMs) : 'Click when the shrinking ring meets the target'}</div>
    <footer className="play-footer rhythm-footer">
      <div className="time-display">{formatTime(s.progress)} <span>/ {formatTime(s.duration)}</span></div>
      <div className="timing-panel">
        <div className="timing-labels"><span>EARLY</span><strong>PERFECT</strong><span>LATE</span></div>
        <div className="timing-meter" aria-label="Timing meter: early on the left, late on the right">
          <div className="close-zone" /><div className="perfect-zone" /><div className="timing-center" />
          {s.errors.map((value, index) => <i key={`${index}:${value}`} className="timing-history" style={{ left: `${50 + Math.max(-180, Math.min(180, value)) / 3.6}%`, opacity: 0.15 + index / Math.max(1, s.errors.length) * 0.5 }} />)}
          {error !== null && error !== undefined && <i className="timing-marker" style={{ left: `${50 + Math.max(-180, Math.min(180, error)) / 3.6}%`, background: judgmentColors[feedback!.grade] }} />}
        </div>
        <div className="timing-caption">±45 ms perfect · ±100 ms close · {s.totalTargets} targets</div>
      </div>
      <div className="play-help">Click / tap the numbered targets<br />Space: pause · R: retry after results</div>
    </footer>
    {s.state === 'countdown' && <div className="countdown-overlay"><span>LISTEN TO THE COUNT-IN</span><strong>{s.countdown}</strong><p>Click the center when the approach ring closes.</p></div>}
    {s.state === 'paused' && <div className="game-overlay"><section className="overlay-card"><span className="eyebrow">TAKE A BREATHER</span><h2>Paused</h2><p>The music, targets, and timing windows are paused together.</p><div className="button-row"><button className="primary-button" onClick={onResume}>Resume song</button><button className="secondary-button" onClick={onMenu}>Song library</button></div></section></div>}
    {finished && <div className="game-overlay"><section className="overlay-card results"><span className="eyebrow">SONG COMPLETE</span><h2>That’s your rhythm.</h2><div className="result-score"><strong>{s.score.toLocaleString()}</strong><span className="rank">{rank}</span></div><div className="result-stats"><div><strong>{s.accuracy.toFixed(1)}%</strong><span>Timing accuracy</span></div><div><strong>{s.bestCombo}</strong><span>Best combo</span></div><div><strong>{Math.round(Math.abs(s.meanError))} ms</strong><span>{s.meanError < -1 ? 'Average early' : s.meanError > 1 ? 'Average late' : 'Average offset'}</span></div></div><div className="judgment-counts">{Object.entries(s.counts).map(([grade, count]) => <div key={grade}><strong style={{ color: judgmentColors[grade] }}>{count}</strong><span>{grade}</span></div>)}</div><p>{s.stray} off-window / empty clicks · Personal best: {best.toLocaleString()}</p><div className="button-row"><button className="primary-button" onClick={onRestart}>Play again</button><button className="secondary-button" onClick={onMenu}>Choose a song</button></div></section></div>}
  </>
}
