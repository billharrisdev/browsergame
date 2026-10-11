import { forwardRef } from 'react'

const GameCanvas = forwardRef<HTMLCanvasElement>(function GameCanvas(_, ref) {
  return <canvas ref={ref} className="game-canvas" aria-label="Rhythm playfield: click or tap numbered targets when their approach rings close" />
})

export default GameCanvas
