// @ts-ignore - PIXI global import
declare global {
  interface Window {
    PIXI: any;
    Tone: any;
    gsap: any;
  }
}

export class FrequencyFrontierGame {
  public app: any = null
  public audioProcessor: any = null
  public player: any = null
  public gameWorld: any = null
  public gameState: 'menu' | 'playing' | 'paused' | 'gameOver' = 'menu'
  
  // Callback functions for React state updates
  public onStateChange?: (state: 'menu' | 'playing' | 'paused' | 'gameOver') => void
  public onScoreChange?: (score: number) => void
  public onHealthChange?: (health: number) => void
  public onFrequencyChange?: (frequency: number) => void
  public onAudioLevelsChange?: (levels: { bass: number; mid: number; high: number }) => void

  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  async initialize() {
    // Wait for PIXI to be available
    if (typeof window === 'undefined' || !window.PIXI) {
      throw new Error('PIXI.js not loaded')
    }

    // Create PIXI Application with hardware acceleration
    this.app = new window.PIXI.Application({
      view: this.canvas,
      width: this.canvas.clientWidth || 800,
      height: this.canvas.clientHeight || 600,
      backgroundColor: 0x000011,
      antialias: true,
      powerPreference: 'high-performance'
    })

    // Initialize audio processor
    const { AudioProcessor } = await import('./audioProcessor')
    this.audioProcessor = new AudioProcessor()
    await this.audioProcessor.initialize()

    // Setup keyboard controls
    this.setupKeyboardControls()

    // Start render loop
    this.app.ticker.add((deltaTime: number) => this.gameLoop(deltaTime))

    console.log("Frequency Frontier game initialized!")
  }

  setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (this.gameState === 'playing') {
          this.pauseGame()
        } else if (this.gameState === 'paused') {
          this.resumeGame()
        }
      }
      
      if (e.code === 'KeyR' && this.gameState === 'gameOver') {
        this.restartGame()
      }
    })
  }

  async startGame() {
    try {
      this.gameState = 'playing'
      this.onStateChange?.(this.gameState)
      
      // Start audio processing
      if (this.audioProcessor.player) {
        this.audioProcessor.startPlayback()
      } else {
        // Use microphone if no file is loaded
        await this.audioProcessor.startMicrophone()
      }

      // Create game objects
      const { Player } = await import('./player')
      const { GameWorld } = await import('./gameWorld')
      
      this.player = new Player(this.app, this.audioProcessor)
      this.gameWorld = new GameWorld(this.app, this.audioProcessor)
      
      console.log('Game started!')
      
    } catch (error) {
      console.error('Failed to start game:', error)
      this.gameState = 'menu'
      this.onStateChange?.(this.gameState)
    }
  }

  pauseGame() {
    this.gameState = 'paused'
    this.onStateChange?.(this.gameState)
    if (this.audioProcessor.player) {
      this.audioProcessor.stopPlayback()
    }
  }

  resumeGame() {
    this.gameState = 'playing'
    this.onStateChange?.(this.gameState)
    if (this.audioProcessor.player) {
      this.audioProcessor.startPlayback()
    }
  }

  restartGame() {
    // Clean up existing game objects
    if (this.player) {
      this.player.dispose()
      this.player = null
    }
    
    if (this.gameWorld) {
      this.gameWorld.dispose()
      this.gameWorld = null
    }

    // Reset game state
    this.gameState = 'menu'
    this.onStateChange?.(this.gameState)
    
    // Start new game
    this.startGame()
  }

  async loadAudioFile(file: File) {
    if (this.audioProcessor) {
      return await this.audioProcessor.loadAudioFile(file)
    }
    return false
  }

  gameLoop(deltaTime: number) {
    if (this.gameState !== 'playing') return

    // Update audio processor
    this.audioProcessor?.update()

    // Update game objects
    if (this.player) {
      this.player.update(deltaTime)
      
      // Update React state
      this.onScoreChange?.(this.player.score)
      this.onHealthChange?.(this.player.health)
      this.onFrequencyChange?.(this.player.currentFrequency)
      
      // Check for game over
      if (this.player.health <= 0) {
        this.gameOver()
        return
      }
    }

    if (this.gameWorld) {
      this.gameWorld.update(deltaTime)
      
      // Check collisions
      if (this.player) {
        this.gameWorld.checkPlayerCollisions(this.player)
      }
    }

    // Update audio levels for React UI
    if (this.audioProcessor) {
      const levels = this.audioProcessor.getNormalizedLevels()
      this.onAudioLevelsChange?.(levels)
    }

    // Update visualizations
    this.updateVisualizations()
  }

  updateVisualizations() {
    if (!this.audioProcessor?.isInitialized) return

    const audioData = this.audioProcessor.getVisualizationData()
    
    // Update visualizer canvas
    this.updateSpectrumVisualizer(audioData)
  }

  updateSpectrumVisualizer(audioData: any) {
    const canvas = document.getElementById('visualizer') as HTMLCanvasElement
    if (!canvas || !audioData.frequencyData) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const barWidth = canvas.width / audioData.frequencyData.length
    let x = 0

    // Draw frequency spectrum
    for (let i = 0; i < audioData.frequencyData.length; i++) {
      const value = Math.abs(audioData.frequencyData[i]) * 1000
      const barHeight = Math.min(value, canvas.height * 0.5)

      // Color gradient based on frequency
      const hue = (i / audioData.frequencyData.length) * 240 // Blue to red
      ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.6)`
      
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
      x += barWidth
    }
  }

  gameOver() {
    this.gameState = 'gameOver'
    this.onStateChange?.(this.gameState)
    
    // Stop audio
    if (this.audioProcessor.player) {
      this.audioProcessor.stopPlayback()
    }
    
    console.log('Game Over! Final Score:', this.player ? this.player.score : 0)
  }

  dispose() {
    // Clean up all game resources
    if (this.player) {
      this.player.dispose()
    }
    
    if (this.gameWorld) {
      this.gameWorld.dispose()
    }
    
    if (this.audioProcessor) {
      this.audioProcessor.dispose()
    }
    
    if (this.app) {
      this.app.destroy(true)
    }
  }
}
