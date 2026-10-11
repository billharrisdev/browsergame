import { forwardRef } from 'react'

const GameCanvas = forwardRef<HTMLCanvasElement>(function GameCanvas(_, ref) {
  return <canvas ref={ref} className="game-canvas" aria-label="Frequency Frontier playfield: collect numbered shapes and dodge orange hazards" />
})

export default GameCanvas
