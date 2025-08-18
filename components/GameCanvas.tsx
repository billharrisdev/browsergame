import React, { forwardRef } from 'react'

interface GameCanvasProps {
  className?: string
}

const GameCanvas = forwardRef<HTMLCanvasElement, GameCanvasProps>(({ className = '' }, ref) => {
  return (
    <canvas
      ref={ref}
      id="gameCanvas"
      className={`flex-1 border-2 border-neon-cyan shadow-lg shadow-neon-cyan/30 ${className}`}
      style={{
        background: 'radial-gradient(circle at center, #001122 0%, #000000 100%)'
      }}
    />
  )
})

GameCanvas.displayName = 'GameCanvas'

export default GameCanvas
