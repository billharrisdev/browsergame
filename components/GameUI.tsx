import React from 'react'

interface GameUIProps {
  gameState: 'menu' | 'playing' | 'paused' | 'gameOver'
  score: number
  health: number
  frequency: number
  audioLevels: { bass: number; mid: number; high: number }
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onAudioUpload: (file: File) => void
}

export default function GameUI({
  gameState,
  score,
  health,
  frequency,
  audioLevels,
  onStart,
  onPause,
  onResume,
  onRestart,
  onAudioUpload
}: GameUIProps) {
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onAudioUpload(file)
    }
  }

  const getFrequencyRange = (freq: number) => {
    if (freq < 250) return 'bass'
    if (freq < 4000) return 'mid'
    return 'high'
  }

  const getFrequencyColor = (range: string) => {
    switch (range) {
      case 'bass': return 'text-bass'
      case 'mid': return 'text-mid'
      case 'high': return 'text-high'
      default: return 'text-white'
    }
  }

  const freqRange = getFrequencyRange(frequency)

  return (
    <>
      {/* Main UI Panel */}
      <div className="ui-panel absolute top-0 left-0 right-0 z-50 p-5">
        {/* Title */}
        <h1 className="text-center text-4xl font-bold text-gradient-neon glow-neon-cyan mb-5">
          Frequency Frontier
        </h1>
        
        {/* Controls */}
        <div className="flex justify-center gap-5 mb-5">
          <button
            onClick={gameState === 'menu' ? onStart : gameState === 'playing' ? onPause : onResume}
            className="game-button"
          >
            {gameState === 'menu' ? 'Start Game' : 
             gameState === 'playing' ? 'Pause' : 'Resume'}
          </button>
          
          <button
            onClick={() => document.getElementById('musicInput')?.click()}
            className="game-button"
          >
            Upload Music
          </button>
          
          <input
            type="file"
            id="musicInput"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        
        {/* Game Info */}
        <div className="flex justify-center gap-8 text-lg font-bold">
          <div className="game-info-item">
            Score: <span className="text-neon-cyan">{score}</span>
          </div>
          <div className="game-info-item">
            Frequency: <span className={getFrequencyColor(freqRange)}>{Math.round(frequency)}Hz</span>
          </div>
          <div className="game-info-item">
            Health: <span className={health > 50 ? 'text-green-400' : health > 25 ? 'text-yellow-400' : 'text-red-400'}>
              {health}
            </span>
          </div>
        </div>
      </div>

      {/* Frequency Display */}
      <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 w-80 h-16 frequency-display z-40">
        <div className="flex items-center justify-center space-x-4">
          <div className="text-2xl font-bold">
            <span className={getFrequencyColor(freqRange)}>
              {Math.round(frequency)}Hz
            </span>
          </div>
          <div className="text-sm text-gray-300">
            {freqRange.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Audio Level Indicators */}
      <div className="absolute left-5 top-1/2 transform -translate-y-1/2 space-y-4 z-40">
        <div className="flex flex-col items-center space-y-2">
          <div className="text-xs text-bass font-bold">BASS</div>
          <div className="w-4 h-24 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="w-full bg-bass transition-all duration-100 rounded-full"
              style={{ height: `${audioLevels.bass * 100}%`, marginTop: `${100 - (audioLevels.bass * 100)}%` }}
            />
          </div>
        </div>
        
        <div className="flex flex-col items-center space-y-2">
          <div className="text-xs text-mid font-bold">MID</div>
          <div className="w-4 h-24 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="w-full bg-mid transition-all duration-100 rounded-full"
              style={{ height: `${audioLevels.mid * 100}%`, marginTop: `${100 - (audioLevels.mid * 100)}%` }}
            />
          </div>
        </div>
        
        <div className="flex flex-col items-center space-y-2">
          <div className="text-xs text-high font-bold">HIGH</div>
          <div className="w-4 h-24 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="w-full bg-high transition-all duration-100 rounded-full"
              style={{ height: `${audioLevels.high * 100}%`, marginTop: `${100 - (audioLevels.high * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Controls Help */}
      <div className="absolute right-5 bottom-5 text-sm text-gray-400 space-y-1 z-40">
        <div>Mouse: Move player</div>
        <div>↑↓: Shift frequency</div>
        <div>A/D: Fine tune</div>
        <div>1/2/3: Bass/Mid/High</div>
        <div>Space: Pause</div>
      </div>
    </>
  )
}
