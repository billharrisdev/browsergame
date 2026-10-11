import { GameSnapshot, judgmentColors } from '../lib/game-engine'
import { hitWindow, Stick, subdivisionLabels } from '../lib/game-engine/rhythm'
import { describeHit } from '../lib/game-engine/gameWorld'

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
  onHit: (x: number, y: number, stamp: number, hand: Stick) => void
  onStick: (hand: Stick, stamp: number) => void
  metronome: boolean
  onMetronome: () => void
}

export default function GameUI({ snapshot: s, title, onPause, onResume, onRestart, onMenu, onSettings, best, generated, onHit, onStick, metronome, onMetronome }: GameUIProps) {
  const finished = s.state === 'complete'
  const rank = s.accuracy >= 95 ? 'S' : s.accuracy >= 80 ? 'A' : s.accuracy >= 65 ? 'B' : 'C'
  const feedback = s.feedback
  const error = feedback?.errorMs
  const labels = subdivisionLabels(s.division)
  const meterLimit = hitWindow * 1000
  const meterPosition = (value: number) => 50 + Math.max(-meterLimit, Math.min(meterLimit, value)) / meterLimit * 50
  const zone = (windowMs: number) => ({ left: `${meterPosition(-windowMs)}%`, right: `${100 - meterPosition(windowMs)}%` })
  return <>
    {s.state === 'playing' && <div className="target-input-layer">{s.targets.map(target => <button key={target.id} className="target-input" aria-label={`Target ${target.id}${target.hand ? ` ${target.hand} stick` : ''}`} style={{ left: target.x - target.radius, top: target.y - target.radius, width: target.radius * 2, height: target.radius * 2 }} onContextMenu={event => event.preventDefault()} onPointerDown={event => {
      if (!event.isPrimary || ![0, 2].includes(event.button)) return
      event.preventDefault()
      onHit(event.clientX, event.clientY, event.timeStamp, event.button === 2 ? 'R' : 'L')
    }} onClick={event => {
      if (event.detail === 0) onHit(target.x, target.y, performance.now(), target.hand || 'L')
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
    <aside className={`beat-counter ${s.beat.phase < 0.16 && s.beat.total > 0 ? 'on-beat' : ''}`} aria-label="Beat counter">
      <div className="beat-counter-heading"><span>BEAT {s.beat.total || '—'}</span><button onClick={onMetronome} className="metronome-toggle" aria-pressed={metronome} aria-label="Toggle metronome">{metronome ? 'Click ON' : 'Click OFF'}</button></div>
      <div className="beat-counter-number">{s.beat.beat || '—'}<small>{s.beat.total > 0 ? labels[s.beat.subdivision] : ''}</small><span>/ {s.meter}</span></div>
      <div className="beat-subdivisions">{Array.from({ length: s.meter * s.division }, (_, index) => <i key={index} className={s.beat.total > 0 && index === (s.beat.beat - 1) * s.division + s.beat.subdivision ? 'active' : ''}>{index % s.division === 0 ? Math.floor(index / s.division) + 1 : labels[index % s.division]}</i>)}</div>
      <small className="beat-counter-caption">Cycle {s.beat.bar || '—'} · {s.meterVerified ? `${s.meter}/4 meter` : 'estimated grouping'}</small>
    </aside>
    <div className="sticking-panel" aria-label="Sticking pattern">
      <span className="eyebrow">{s.pattern === 'Pulse' ? 'LEVEL 1 · QUARTER-NOTE PULSE' : s.pattern === 'Alternating' ? `LEVEL ${s.division === 2 ? '2' : '3'} · ALTERNATE FIRST` : `LEVEL ${s.division === 2 ? '2' : '3'} · ${s.division === 2 ? 'EIGHTH' : 'SIXTEENTH'}-NOTE PARADIDDLE`}</span>
      {s.patternSteps.length > 0 ? <div className="sticking-sequence">{s.patternSteps.map((hand, index) => <span key={index} className={`stick-${hand} ${index === s.patternStep ? 'current' : ''} ${index === 4 ? 'phrase-start' : ''}`}>{hand}</span>)}</div> : <p>Either stick · aim and click, or use Ctrl</p>}
      {s.pattern === 'Alternating' && <small>Two practice cycles, then R L R R · L R L L</small>}
    </div>
    <div className="timing-feedback" role="status" aria-live="polite" style={{ color: feedback ? judgmentColors[feedback.grade] : undefined }}>{feedback ? describeHit(feedback) : 'Hit when the approach ring closes. Ctrl strikes the next target.'}</div>
    <footer className="play-footer rhythm-footer">
      <div className="time-display">{formatTime(s.progress)} <span>/ {formatTime(s.duration)}</span></div>
      <div className="timing-panel">
        <div className="timing-labels"><span>EARLY</span><strong>PERFECT</strong><span>LATE</span></div>
        <div className="timing-meter" aria-label="Timing meter: early on the left, late on the right">
          <div className="hit-zone" style={zone(s.hitWindowMs)} /><div className="close-zone" style={zone(s.closeWindowMs)} /><div className="perfect-zone" style={zone(s.perfectWindowMs)} /><div className="timing-center" />
          {s.errors.map((value, index) => <i key={`${index}:${value}`} className="timing-history" style={{ left: `${meterPosition(value)}%`, opacity: 0.15 + index / Math.max(1, s.errors.length) * 0.5 }} />)}
          {error !== null && error !== undefined && <i className="timing-marker" style={{ left: `${meterPosition(error)}%`, background: judgmentColors[feedback!.grade] }} />}
        </div>
        <div className="timing-caption">±{s.perfectWindowMs} ms perfect · ±{s.closeWindowMs} ms close · ±{s.hitWindowMs} ms hit<small>{s.totalTargets} targets</small></div>
      </div>
      <div className="play-help">Aim + left / right mouse click<br />Left / Right Ctrl: automatic stick strikes</div>
    </footer>
    <div className="stick-controls" aria-label="Drum sticks">{(['L', 'R'] as const).map(hand => <button key={hand} className={`stick-pad stick-${hand} ${s.pressed[hand] ? 'pressed' : ''} ${s.expectedStick === hand ? 'expected' : ''}`} aria-label={`${hand === 'L' ? 'Left' : 'Right'} stick`} disabled={s.state !== 'playing'} onPointerDown={event => {
      if (event.button !== 0) return
      event.preventDefault(); onStick(hand, event.timeStamp)
    }} onClick={event => { if (event.detail === 0) onStick(hand, performance.now()) }}><strong>{hand}</strong><span>{hand === 'L' ? 'Left Ctrl / left click' : 'Right Ctrl / right click'}<small>Tap / press · release · repeat</small></span></button>)}</div>
    {s.state === 'countdown' && <div className="countdown-overlay"><span>LISTEN TO THE COUNT-IN</span><strong>{s.countdown}</strong><p>Click the center when the approach ring closes.</p></div>}
    {s.state === 'paused' && <div className="game-overlay"><section className="overlay-card"><span className="eyebrow">TAKE A BREATHER</span><h2>Paused</h2><p>The music, targets, and timing windows are paused together.</p><div className="button-row"><button className="primary-button" onClick={onResume}>Resume song</button><button className="secondary-button" onClick={onMenu}>Song library</button></div></section></div>}
    {finished && <div className="game-overlay"><section className="overlay-card results"><span className="eyebrow">SONG COMPLETE</span><h2>That’s your rhythm.</h2><div className="result-score"><strong>{s.score.toLocaleString()}</strong><span className="rank">{rank}</span></div><div className="result-stats"><div><strong>{s.timingAccuracy.toFixed(1)}%</strong><span>Timing accuracy</span></div><div><strong>{s.stickAttempts ? `${s.stickAccuracy.toFixed(1)}%` : '—'}</strong><span>Sticking accuracy</span></div><div><strong>{s.bestCombo}</strong><span>Best combo</span></div></div><div className="judgment-counts">{Object.entries(s.counts).map(([grade, count]) => <div key={grade}><strong style={{ color: judgmentColors[grade] }}>{count}</strong><span>{grade}</span></div>)}</div><p>Average: {Math.round(Math.abs(s.meanError))} ms {s.meanError < 0 ? 'early' : 'late'} · Combined accuracy: {s.accuracy.toFixed(1)}%<br />{s.stray} off-window / empty clicks · Personal best: {best.toLocaleString()}</p><div className="button-row"><button className="primary-button" onClick={onRestart}>Play again</button><button className="secondary-button" onClick={onMenu}>Choose a song</button></div></section></div>}
  </>
}
