class FrequencyFrontierGame {
    constructor() {
        this.app = null;
        this.audioProcessor = null;
        this.player = null;
        this.gameWorld = null;
        this.gameState = 'menu'; // 'menu', 'playing', 'paused', 'gameOver'
        this.gameLoop = null;
        this.lastTime = 0;
        
        this.initialize();
    }

    async initialize() {
        // Create PIXI Application with hardware acceleration
        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight - 150, // Account for UI
            backgroundColor: 0x000011,
            antialias: true,
            powerPreference: 'high-performance'
        });

        // Add canvas to the game container
        const gameContainer = document.getElementById('gameContainer');
        const existingCanvas = document.getElementById('gameCanvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }
        
        this.app.view.id = 'gameCanvas';
        gameContainer.appendChild(this.app.view);

        // Initialize audio processor
        this.audioProcessor = new AudioProcessor();
        await this.audioProcessor.initialize();

        // Setup UI event listeners
        this.setupEventListeners();

        // Start render loop
        this.app.ticker.add((deltaTime) => this.gameLoop(deltaTime));

        console.log("Frequency Frontier game initialized!");
    }

    setupEventListeners() {
        const startBtn = document.getElementById('startBtn');
        const uploadBtn = document.getElementById('uploadBtn');
        const musicInput = document.getElementById('musicInput');

        startBtn.addEventListener('click', () => {
            if (this.gameState === 'menu') {
                this.startGame();
            } else if (this.gameState === 'playing') {
                this.pauseGame();
            } else if (this.gameState === 'paused') {
                this.resumeGame();
            }
        });

        uploadBtn.addEventListener('click', () => {
            musicInput.click();
        });

        musicInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const success = await this.audioProcessor.loadAudioFile(file);
                if (success) {
                    console.log('Audio file loaded successfully');
                    // Enable start button or auto-start
                    startBtn.textContent = 'Start Game';
                    startBtn.disabled = false;
                }
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Game controls
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameState === 'playing') {
                    this.pauseGame();
                } else if (this.gameState === 'paused') {
                    this.resumeGame();
                }
            }
            
            if (e.code === 'KeyR' && this.gameState === 'gameOver') {
                this.restartGame();
            }
        });
    }

    async startGame() {
        try {
            this.gameState = 'playing';
            
            // Start audio processing
            if (this.audioProcessor.player) {
                this.audioProcessor.startPlayback();
            } else {
                // Use microphone if no file is loaded
                await this.audioProcessor.startMicrophone();
            }

            // Create game objects
            this.player = new Player(this.app, this.audioProcessor);
            this.gameWorld = new GameWorld(this.app, this.audioProcessor);

            // Update UI
            document.getElementById('startBtn').textContent = 'Pause';
            
            console.log('Game started!');
            
        } catch (error) {
            console.error('Failed to start game:', error);
            this.gameState = 'menu';
        }
    }

    pauseGame() {
        this.gameState = 'paused';
        if (this.audioProcessor.player) {
            this.audioProcessor.stopPlayback();
        }
        document.getElementById('startBtn').textContent = 'Resume';
    }

    resumeGame() {
        this.gameState = 'playing';
        if (this.audioProcessor.player) {
            this.audioProcessor.startPlayback();
        }
        document.getElementById('startBtn').textContent = 'Pause';
    }

    restartGame() {
        // Clean up existing game objects
        if (this.player) {
            this.player.dispose();
            this.player = null;
        }
        
        if (this.gameWorld) {
            this.gameWorld.dispose();
            this.gameWorld = null;
        }

        // Reset game state
        this.gameState = 'menu';
        document.getElementById('startBtn').textContent = 'Start Game';
        
        // Start new game
        this.startGame();
    }

    gameLoop(deltaTime) {
        if (this.gameState !== 'playing') return;

        // Update audio processor
        this.audioProcessor.update();

        // Update game objects
        if (this.player) {
            this.player.update(deltaTime);
            
            // Check for game over
            if (this.player.health <= 0) {
                this.gameOver();
                return;
            }
        }

        if (this.gameWorld) {
            this.gameWorld.update(deltaTime);
            
            // Check collisions
            if (this.player) {
                this.gameWorld.checkPlayerCollisions(this.player);
            }
        }

        // Update visualizations
        this.updateVisualizations();
    }

    updateVisualizations() {
        if (!this.audioProcessor.isInitialized) return;

        const audioData = this.audioProcessor.getVisualizationData();
        const levels = this.audioProcessor.getNormalizedLevels();

        // Update frequency display
        const freqDisplay = document.getElementById('frequencyDisplay');
        if (freqDisplay && this.player) {
            const range = this.player.getFrequencyRange();
            freqDisplay.style.borderColor = this.getFrequencyColor(range);
            freqDisplay.style.boxShadow = `0 0 20px ${this.getFrequencyColor(range)}`;
        }

        // Update visualizer canvas
        this.updateSpectrumVisualizer(audioData);
    }

    updateSpectrumVisualizer(audioData) {
        const canvas = document.getElementById('visualizer');
        if (!canvas || !audioData.frequencyData) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = canvas.width / audioData.frequencyData.length;
        let x = 0;

        // Draw frequency spectrum
        for (let i = 0; i < audioData.frequencyData.length; i++) {
            const value = Math.abs(audioData.frequencyData[i]) * 1000;
            const barHeight = Math.min(value, canvas.height * 0.5);

            // Color gradient based on frequency
            const hue = (i / audioData.frequencyData.length) * 240; // Blue to red
            ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.6)`;
            
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth;
        }
    }

    getFrequencyColor(range) {
        switch (range) {
            case 'bass': return '#ff3333';
            case 'mid': return '#33ff33';
            case 'high': return '#3333ff';
            default: return '#ffffff';
        }
    }

    gameOver() {
        this.gameState = 'gameOver';
        
        // Stop audio
        if (this.audioProcessor.player) {
            this.audioProcessor.stopPlayback();
        }

        // Update UI
        document.getElementById('startBtn').textContent = 'Game Over - Press R to Restart';
        
        // Show game over effects
        this.showGameOverEffects();
        
        console.log('Game Over! Final Score:', this.player ? this.player.score : 0);
    }

    showGameOverEffects() {
        // Create game over overlay
        const overlay = document.createElement('div');
        overlay.id = 'gameOverOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 2em;
            z-index: 1000;
        `;
        
        overlay.innerHTML = `
            <h2>Game Over!</h2>
            <p>Final Score: ${this.player ? this.player.score : 0}</p>
            <p>Press R to restart</p>
        `;
        
        document.body.appendChild(overlay);
        
        // Remove overlay after a delay or on restart
        setTimeout(() => {
            const existingOverlay = document.getElementById('gameOverOverlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
        }, 5000);
    }

    handleResize() {
        if (this.app) {
            this.app.renderer.resize(window.innerWidth, window.innerHeight - 150);
        }
    }

    dispose() {
        // Clean up all game resources
        if (this.player) {
            this.player.dispose();
        }
        
        if (this.gameWorld) {
            this.gameWorld.dispose();
        }
        
        if (this.audioProcessor) {
            this.audioProcessor.dispose();
        }
        
        if (this.app) {
            this.app.destroy(true);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for WebGL support
    if (!PIXI.utils.isWebGLSupported()) {
        alert('WebGL is not supported in your browser. Please use a modern browser for the best experience.');
        return;
    }
    
    // Initialize the game
    window.game = new FrequencyFrontierGame();
    
    console.log('Frequency Frontier loaded successfully!');
    console.log('Controls:');
    console.log('- Mouse: Move player');
    console.log('- Arrow Keys: Shift frequency up/down');
    console.log('- A/D Keys: Fine-tune frequency');
    console.log('- 1/2/3 Keys: Quick frequency jumps (Bass/Mid/High)');
    console.log('- Space: Pause/Resume');
    console.log('- R: Restart (when game over)');
});
