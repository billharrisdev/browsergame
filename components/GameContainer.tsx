import React, { useState, useEffect, useRef } from 'react'
import GameCanvas from './GameCanvas'
import GameUI from './GameUI'
import { FrequencyFrontierGame } from '../lib/game-engine'

export default function GameContainer() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver'>('menu')
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(100)
  const [frequency, setFrequency] = useState(440)
  const [audioLevels, setAudioLevels] = useState({ bass: 0, mid: 0, high: 0 })
  
  const gameRef = useRef<FrequencyFrontierGame | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startGame = async () => {
    if (!canvasRef.current) return
    
    try {
      gameRef.current = new FrequencyFrontierGame(canvasRef.current)
      await gameRef.current.initialize()
      
      // Set up game state callbacks
      gameRef.current.onStateChange = (state) => setGameState(state)
      gameRef.current.onScoreChange = (score) => setScore(score)
      gameRef.current.onHealthChange = (health) => setHealth(health)
      gameRef.current.onFrequencyChange = (freq) => setFrequency(freq)
      gameRef.current.onAudioLevelsChange = (levels) => setAudioLevels(levels)
      
      await gameRef.current.startGame()
      setGameState('playing')
    } catch (error) {
      console.error('Failed to start game:', error)
    }
  }

  const pauseGame = () => {
    gameRef.current?.pauseGame()
    setGameState('paused')
  }

  const resumeGame = () => {
    gameRef.current?.resumeGame()
    setGameState('playing')
  }

  const restartGame = () => {
    gameRef.current?.restartGame()
    setGameState('menu')
    setScore(0)
    setHealth(100)
    setFrequency(440)
  }

  const handleAudioUpload = async (file: File) => {
    if (gameRef.current) {
      await gameRef.current.loadAudioFile(file)
    }
  }

  useEffect(() => {
    return () => {
      gameRef.current?.dispose()
    }
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Game UI */}
      <GameUI
        gameState={gameState}
        score={score}
        health={health}
        frequency={frequency}
        audioLevels={audioLevels}
        onStart={startGame}
        onPause={pauseGame}
        onResume={resumeGame}
        onRestart={restartGame}
        onAudioUpload={handleAudioUpload}
      />
      
      {/* Game Canvas */}
      <GameCanvas ref={canvasRef} />
      
      {/* Audio Visualizer Canvas */}
      <canvas
        id="visualizer"
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Game Over Overlay */}
      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center z-50">
          <div className="text-center space-y-6">
            <h2 className="text-6xl font-bold text-gradient-neon glow-neon-cyan">
              Game Over!
            </h2>
            <p className="text-2xl text-neon-cyan">
              Final Score: <span className="font-bold text-white">{score}</span>
            </p>
            <p className="text-lg text-gray-300">
              Press R to restart or click the restart button
            </p>
            <button
              onClick={restartGame}
              className="game-button text-xl px-8 py-4"
            >
              Restart Game
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
