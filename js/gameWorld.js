class GameWorld {
    constructor(app, audioProcessor) {
        this.app = app;
        this.audioProcessor = audioProcessor;
        
        // World properties
        this.platforms = [];
        this.obstacles = [];
        this.collectibles = [];
        this.particles = [];
        
        // Visual layers
        this.backgroundLayer = new PIXI.Container();
        this.platformLayer = new PIXI.Container();
        this.obstacleLayer = new PIXI.Container();
        this.collectibleLayer = new PIXI.Container();
        this.particleLayer = new PIXI.Container();
        
        // Add layers to stage
        this.app.stage.addChild(this.backgroundLayer);
        this.app.stage.addChild(this.platformLayer);
        this.app.stage.addChild(this.obstacleLayer);
        this.app.stage.addChild(this.collectibleLayer);
        this.app.stage.addChild(this.particleLayer);
        
        // World generation
        this.nextPlatformTime = 0;
        this.nextObstacleTime = 0;
        this.nextCollectibleTime = 0;
        
        this.createBackground();
    }

    createBackground() {
        // Create animated background based on audio visualization
        this.backgroundGraphics = new PIXI.Graphics();
        this.backgroundLayer.addChild(this.backgroundGraphics);
        
        // Create grid pattern
        this.createGrid();
    }

    createGrid() {
        const gridSize = 50;
        const gridGraphics = new PIXI.Graphics();
        
        gridGraphics.lineStyle(1, 0x333366, 0.3);
        
        // Vertical lines
        for (let x = 0; x < this.app.screen.width; x += gridSize) {
            gridGraphics.moveTo(x, 0);
            gridGraphics.lineTo(x, this.app.screen.height);
        }
        
        // Horizontal lines
        for (let y = 0; y < this.app.screen.height; y += gridSize) {
            gridGraphics.moveTo(0, y);
            gridGraphics.lineTo(this.app.screen.width, y);
        }
        
        this.backgroundLayer.addChild(gridGraphics);
    }

    update(deltaTime) {
        this.updateBackground();
        this.generateWorldElements(deltaTime);
        this.updatePlatforms(deltaTime);
        this.updateObstacles(deltaTime);
        this.updateCollectibles(deltaTime);
        this.updateParticles(deltaTime);
    }

    updateBackground() {
        if (!this.audioProcessor.isInitialized) return;
        
        const audioData = this.audioProcessor.getVisualizationData();
        const levels = this.audioProcessor.getNormalizedLevels();
        
        this.backgroundGraphics.clear();
        
        // Draw frequency visualization bars
        if (audioData.frequencyData && audioData.frequencyData.length > 0) {
            const barWidth = this.app.screen.width / audioData.frequencyData.length;
            
            for (let i = 0; i < audioData.frequencyData.length; i++) {
                const value = Math.abs(audioData.frequencyData[i]) * 1000; // Amplify for visibility
                const height = Math.min(value, this.app.screen.height * 0.3);
                
                // Color based on frequency range
                let color;
                const freqRatio = i / audioData.frequencyData.length;
                if (freqRatio < 0.1) color = 0xff3333; // Bass - Red
                else if (freqRatio < 0.4) color = 0x33ff33; // Mid - Green
                else color = 0x3333ff; // High - Blue
                
                this.backgroundGraphics.beginFill(color, 0.3);
                this.backgroundGraphics.drawRect(
                    i * barWidth, 
                    this.app.screen.height - height, 
                    barWidth - 1, 
                    height
                );
                this.backgroundGraphics.endFill();
            }
        }
    }

    generateWorldElements(deltaTime) {
        const currentTime = Date.now();
        const levels = this.audioProcessor.getNormalizedLevels();
        
        // Generate platforms based on bass levels
        if (currentTime > this.nextPlatformTime && levels.bass > 0.3) {
            this.createPlatform(levels.bass);
            this.nextPlatformTime = currentTime + 1000 + Math.random() * 2000;
        }
        
        // Generate obstacles based on mid levels
        if (currentTime > this.nextObstacleTime && levels.mid > 0.4) {
            this.createObstacle(levels.mid);
            this.nextObstacleTime = currentTime + 800 + Math.random() * 1500;
        }
        
        // Generate collectibles based on high levels
        if (currentTime > this.nextCollectibleTime && levels.high > 0.2) {
            this.createCollectible(levels.high);
            this.nextCollectibleTime = currentTime + 1500 + Math.random() * 2500;
        }
    }

    createPlatform(intensity) {
        const platform = {
            graphics: new PIXI.Graphics(),
            x: this.app.screen.width + 50,
            y: Math.random() * (this.app.screen.height - 200) + 100,
            width: 100 + intensity * 100,
            height: 20,
            speed: 2 + intensity * 2,
            type: 'bass'
        };
        
        platform.graphics.beginFill(0xff3333, 0.7);
        platform.graphics.drawRect(0, 0, platform.width, platform.height);
        platform.graphics.endFill();
        
        platform.graphics.x = platform.x;
        platform.graphics.y = platform.y;
        
        this.platformLayer.addChild(platform.graphics);
        this.platforms.push(platform);
    }

    createObstacle(intensity) {
        const obstacle = {
            graphics: new PIXI.Graphics(),
            x: this.app.screen.width + 50,
            y: Math.random() * (this.app.screen.height - 200) + 100,
            radius: 15 + intensity * 20,
            speed: 3 + intensity * 3,
            damage: Math.floor(10 + intensity * 20),
            type: 'mid',
            rotationSpeed: 0.1 + intensity * 0.1
        };
        
        // Create spiky obstacle
        obstacle.graphics.beginFill(0xffff33, 0.8);
        obstacle.graphics.lineStyle(2, 0xff6600);
        
        const spikes = 8;
        obstacle.graphics.moveTo(obstacle.radius, 0);
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2;
            const radius = i % 2 === 0 ? obstacle.radius : obstacle.radius * 0.6;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            obstacle.graphics.lineTo(x, y);
        }
        obstacle.graphics.closePath();
        obstacle.graphics.endFill();
        
        obstacle.graphics.x = obstacle.x;
        obstacle.graphics.y = obstacle.y;
        
        this.obstacleLayer.addChild(obstacle.graphics);
        this.obstacles.push(obstacle);
    }

    createCollectible(intensity) {
        const collectible = {
            graphics: new PIXI.Graphics(),
            x: this.app.screen.width + 50,
            y: Math.random() * (this.app.screen.height - 200) + 100,
            radius: 8 + intensity * 12,
            speed: 1 + intensity * 1.5,
            points: Math.floor(50 + intensity * 100),
            type: 'high',
            floatOffset: Math.random() * Math.PI * 2,
            pulsePhase: 0
        };
        
        collectible.graphics.beginFill(0x00ffff, 0.9);
        collectible.graphics.drawStar(0, 0, 6, collectible.radius, collectible.radius * 0.6);
        collectible.graphics.endFill();
        
        // Add glow effect
        const glowFilter = new PIXI.filters.GlowFilter({
            distance: 15,
            outerStrength: 2,
            color: 0x00ffff
        });
        collectible.graphics.filters = [glowFilter];
        
        collectible.graphics.x = collectible.x;
        collectible.graphics.y = collectible.y;
        
        this.collectibleLayer.addChild(collectible.graphics);
        this.collectibles.push(collectible);
    }

    updatePlatforms(deltaTime) {
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const platform = this.platforms[i];
            platform.x -= platform.speed;
            platform.graphics.x = platform.x;
            
            // Remove platforms that are off-screen
            if (platform.x + platform.width < 0) {
                this.platformLayer.removeChild(platform.graphics);
                platform.graphics.destroy();
                this.platforms.splice(i, 1);
            }
        }
    }

    updateObstacles(deltaTime) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.x -= obstacle.speed;
            obstacle.graphics.x = obstacle.x;
            obstacle.graphics.rotation += obstacle.rotationSpeed;
            
            // Remove obstacles that are off-screen
            if (obstacle.x + obstacle.radius < 0) {
                this.obstacleLayer.removeChild(obstacle.graphics);
                obstacle.graphics.destroy();
                this.obstacles.splice(i, 1);
            }
        }
    }

    updateCollectibles(deltaTime) {
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            collectible.x -= collectible.speed;
            collectible.floatOffset += deltaTime * 0.005;
            collectible.pulsePhase += deltaTime * 0.01;
            
            // Floating animation
            collectible.graphics.x = collectible.x;
            collectible.graphics.y = collectible.y + Math.sin(collectible.floatOffset) * 10;
            
            // Pulsing scale
            const scale = 1 + Math.sin(collectible.pulsePhase) * 0.2;
            collectible.graphics.scale.set(scale);
            
            // Remove collectibles that are off-screen
            if (collectible.x + collectible.radius < 0) {
                this.collectibleLayer.removeChild(collectible.graphics);
                collectible.graphics.destroy();
                this.collectibles.splice(i, 1);
            }
        }
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= deltaTime;
            particle.graphics.alpha = particle.life / particle.maxLife;
            particle.graphics.x = particle.x;
            particle.graphics.y = particle.y;
            
            if (particle.life <= 0) {
                this.particleLayer.removeChild(particle.graphics);
                particle.graphics.destroy();
                this.particles.splice(i, 1);
            }
        }
    }

    createParticleExplosion(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const particle = {
                graphics: new PIXI.Graphics(),
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1000,
                maxLife: 1000
            };
            
            particle.graphics.beginFill(color);
            particle.graphics.drawCircle(0, 0, 2 + Math.random() * 3);
            particle.graphics.endFill();
            
            this.particleLayer.addChild(particle.graphics);
            this.particles.push(particle);
        }
    }

    // Collision detection methods
    checkPlayerCollisions(player) {
        // Check collectible collisions
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            const dx = player.x - collectible.x;
            const dy = player.y - collectible.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius + collectible.radius) {
                // Collision with collectible
                player.addScore(collectible.points);
                this.createParticleExplosion(collectible.x, collectible.y, 0x00ffff);
                
                // Remove collectible
                this.collectibleLayer.removeChild(collectible.graphics);
                collectible.graphics.destroy();
                this.collectibles.splice(i, 1);
            }
        }
        
        // Check obstacle collisions
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            const dx = player.x - obstacle.x;
            const dy = player.y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius + obstacle.radius) {
                // Check if player can phase through (bass frequency ability)
                if (!player.canPhase()) {
                    player.takeDamage(obstacle.damage);
                    this.createParticleExplosion(obstacle.x, obstacle.y, 0xff3333);
                    
                    // Remove obstacle after collision
                    this.obstacleLayer.removeChild(obstacle.graphics);
                    obstacle.graphics.destroy();
                    this.obstacles.splice(i, 1);
                }
            }
        }
    }

    dispose() {
        // Clean up all world elements
        this.platforms.forEach(platform => {
            this.platformLayer.removeChild(platform.graphics);
            platform.graphics.destroy();
        });
        
        this.obstacles.forEach(obstacle => {
            this.obstacleLayer.removeChild(obstacle.graphics);
            obstacle.graphics.destroy();
        });
        
        this.collectibles.forEach(collectible => {
            this.collectibleLayer.removeChild(collectible.graphics);
            collectible.graphics.destroy();
        });
        
        this.particles.forEach(particle => {
            this.particleLayer.removeChild(particle.graphics);
            particle.graphics.destroy();
        });
        
        // Remove layers
        this.app.stage.removeChild(this.backgroundLayer);
        this.app.stage.removeChild(this.platformLayer);
        this.app.stage.removeChild(this.obstacleLayer);
        this.app.stage.removeChild(this.collectibleLayer);
        this.app.stage.removeChild(this.particleLayer);
    }
}
