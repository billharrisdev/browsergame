export class Player {
    public app: any
    public audioProcessor: any
    
    // Player properties
    public x: number
    public y: number
    public radius: number = 15
    public speed: number = 5
    public currentFrequency: number = 440
    public targetFrequency: number = 440
    public health: number = 100
    public score: number = 0
    
    // Frequency properties
    public minFreq: number = 80   // Bass range start
    public maxFreq: number = 8000 // High range end
    
    // Visual properties
    public trail: Array<{x: number, y: number, alpha: number}> = []
    public maxTrailLength: number = 20
    
    public graphics: any
    public glowFilter: any
    public keys: {[key: string]: boolean} = {}
    public targetX?: number
    public targetY?: number

    constructor(app: any, audioProcessor: any) {
        this.app = app;
        this.audioProcessor = audioProcessor;
        
        // Player properties
        this.x = app.screen.width / 2;
        this.y = app.screen.height / 2;
        this.radius = 15;
        this.speed = 5;
        this.currentFrequency = 440;
        this.targetFrequency = 440;
        this.health = 100;
        this.score = 0;
        
        // Frequency properties
        this.minFreq = 80;   // Bass range start
        this.maxFreq = 8000; // High range end
        
        // Visual properties
        this.trail = [];
        this.maxTrailLength = 20;
        
        this.createSprite();
        this.setupControls();
    }

    createSprite() {
        // Create player graphics
        this.graphics = new (window as any).PIXI.Graphics();
        this.updateGraphics();
        this.app.stage.addChild(this.graphics);
        
        // Create glow effect
        this.glowFilter = new (window as any).PIXI.filters.GlowFilter({
            distance: 20,
            outerStrength: 2,
            innerStrength: 1,
            color: 0x00ffff
        });
        
        this.graphics.filters = [this.glowFilter];
    }

    updateGraphics() {
        this.graphics.clear();
        
        // Get frequency range for color
        const freqRange = this.audioProcessor.getFrequencyRange(this.currentFrequency);
        let color;
        
        switch (freqRange) {
            case 'bass':
                color = 0xff0000; // Red for bass
                break;
            case 'mid':
                color = 0x00ff00; // Green for mid
                break;
            case 'high':
                color = 0x0000ff; // Blue for high
                break;
            default:
                color = 0xffffff;
        }
        
        // Draw main body
        this.graphics.beginFill(color, 0.8);
        this.graphics.drawCircle(0, 0, this.radius);
        this.graphics.endFill();
        
        // Draw frequency indicator ring
        const intensity = this.audioProcessor.getNormalizedLevels()[freqRange] || 0;
        const ringRadius = this.radius + 5 + (intensity * 10);
        
        this.graphics.lineStyle(3, color, 0.5);
        this.graphics.drawCircle(0, 0, ringRadius);
        
        // Update glow color
        this.glowFilter.color = color;
        this.glowFilter.outerStrength = 1 + intensity * 2;
    }

    setupControls() {
        // Mouse controls
        this.app.view.addEventListener('mousemove', (e) => {
            const rect = this.app.view.getBoundingClientRect();
            this.targetX = e.clientX - rect.left;
            this.targetY = e.clientY - rect.top;
        });
        
        // Keyboard controls for frequency shifting
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    update(deltaTime) {
        this.handleInput();
        this.updateFrequency();
        this.updatePosition(deltaTime);
        this.updateTrail();
        this.updateGraphics();
        this.updateUI();
    }

    handleInput() {
        // Frequency shifting with arrow keys
        if (this.keys['ArrowUp']) {
            this.shiftFrequency(50);
        }
        if (this.keys['ArrowDown']) {
            this.shiftFrequency(-50);
        }
        
        // Fine tuning with A/D keys
        if (this.keys['KeyA']) {
            this.shiftFrequency(-10);
        }
        if (this.keys['KeyD']) {
            this.shiftFrequency(10);
        }
        
        // Quick frequency jumps
        if (this.keys['Digit1']) {
            this.targetFrequency = 120; // Bass
        }
        if (this.keys['Digit2']) {
            this.targetFrequency = 440; // Mid
        }
        if (this.keys['Digit3']) {
            this.targetFrequency = 2000; // High
        }
    }

    shiftFrequency(amount) {
        this.targetFrequency = Math.max(this.minFreq, 
            Math.min(this.maxFreq, this.targetFrequency + amount));
    }

    updateFrequency() {
        // Smoothly interpolate to target frequency
        const diff = this.targetFrequency - this.currentFrequency;
        this.currentFrequency += diff * 0.1;
        
        // Update speed based on frequency range
        const freqRange = this.audioProcessor.getFrequencyRange(this.currentFrequency);
        switch (freqRange) {
            case 'bass':
                this.speed = 3; // Slow but can phase through barriers
                break;
            case 'mid':
                this.speed = 5; // Normal speed
                break;
            case 'high':
                this.speed = 8; // Fast but vulnerable
                break;
        }
    }

    updatePosition(deltaTime) {
        // Move towards mouse position if set
        if (this.targetX !== undefined && this.targetY !== undefined) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
                this.x += (dx / distance) * this.speed;
                this.y += (dy / distance) * this.speed;
            }
        }
        
        // Keep player within bounds
        this.x = Math.max(this.radius, Math.min(this.app.screen.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(this.app.screen.height - this.radius, this.y));
        
        // Update sprite position
        this.graphics.x = this.x;
        this.graphics.y = this.y;
    }

    updateTrail() {
        // Add current position to trail
        this.trail.push({ x: this.x, y: this.y, alpha: 1.0 });
        
        // Remove old trail points
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
        
        // Fade trail points
        this.trail.forEach((point, index) => {
            point.alpha = index / this.trail.length;
        });
    }

    updateUI() {
        // Update frequency display
        const freqElement = document.getElementById('frequency');
        if (freqElement) {
            freqElement.textContent = `${Math.round(this.currentFrequency)}Hz`;
        }
        
        // Update health display
        const healthElement = document.getElementById('health');
        if (healthElement) {
            healthElement.textContent = this.health.toString();
        }
        
        // Update score display
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = this.score.toString();
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            // Game over logic will be handled by the main game
        }
        
        // Visual feedback for damage
        (window as any).gsap.to(this.graphics, {
            duration: 0.1,
            alpha: 0.5,
            yoyo: true,
            repeat: 3,
            ease: "power2.inOut"
        });
    }

    addScore(points: number) {
        this.score += points;
        
        // Visual feedback for scoring
        (window as any).gsap.to(this.graphics.scale, {
            duration: 0.2,
            x: 1.2,
            y: 1.2,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut"
        });
    }

    getFrequencyRange() {
        return this.audioProcessor.getFrequencyRange(this.currentFrequency);
    }

    // Check if player can phase through barriers (bass frequency ability)
    canPhase() {
        return this.getFrequencyRange() === 'bass';
    }

    // Get movement speed multiplier based on frequency
    getSpeedMultiplier() {
        const range = this.getFrequencyRange();
        switch (range) {
            case 'bass': return 0.6;
            case 'mid': return 1.0;
            case 'high': return 1.6;
            default: return 1.0;
        }
    }

    dispose() {
        if (this.graphics) {
            this.app.stage.removeChild(this.graphics);
            this.graphics.destroy();
        }
    }
}
