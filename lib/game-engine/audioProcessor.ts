export class AudioProcessor {
    public audioContext: any = null
    public analyzer: any = null
    public microphone: any = null
    public dataArray: Float32Array | null = null
    public bufferLength: number = 0
    public isInitialized: boolean = false
    public currentFrequency: number = 440 // Default frequency
    public frequencyData: number[] = []
    public bassLevel: number = 0
    public midLevel: number = 0
    public highLevel: number = 0
    public player: any = null
    public freqAnalyzer: any = null

    async initialize() {
        try {
            // Initialize Tone.js audio context
            await (window as any).Tone.start();
            this.audioContext = (window as any).Tone.context;
            
            // Create analyzer node
            this.analyzer = new (window as any).Tone.Analyser("fft", 1024);
            
            // Create frequency analyzer for pitch detection
            this.freqAnalyzer = new (window as any).Tone.Analyser("waveform", 1024);
            
            this.bufferLength = this.analyzer.size;
            this.dataArray = new Float32Array(this.bufferLength);
            
            this.isInitialized = true;
            console.log("Audio processor initialized successfully");
            
        } catch (error) {
            console.error("Failed to initialize audio processor:", error);
        }
    }

    async startMicrophone() {
        try {
            // Get microphone input
            this.microphone = new (window as any).Tone.UserMedia();
            await this.microphone.open();
            
            // Connect microphone to analyzers
            this.microphone.connect(this.analyzer);
            this.microphone.connect(this.freqAnalyzer);
            
            console.log("Microphone connected successfully");
            
        } catch (error) {
            console.error("Failed to access microphone:", error);
        }
    }

    async loadAudioFile(file) {
        try {
            // Create audio buffer from file
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Create player for the audio file
            this.player = new (window as any).Tone.Player({
                url: audioBuffer,
                loop: true,
                autostart: false
            });
            
            // Connect player to analyzers
            this.player.connect(this.analyzer);
            this.player.connect(this.freqAnalyzer);
            this.player.toDestination();
            
            console.log("Audio file loaded successfully");
            return true;
            
        } catch (error) {
            console.error("Failed to load audio file:", error);
            return false;
        }
    }

    startPlayback() {
        if (this.player) {
            this.player.start();
        }
    }

    stopPlayback() {
        if (this.player) {
            this.player.stop();
        }
    }

    update() {
        if (!this.isInitialized || !this.analyzer) return;

        // Get frequency domain data
        const frequencyData = this.analyzer.getValue();
        this.frequencyData = Array.from(frequencyData);
        
        // Calculate frequency bands
        const bassEnd = Math.floor(this.bufferLength * 0.1);
        const midEnd = Math.floor(this.bufferLength * 0.4);
        
        // Calculate average levels for each frequency band
        this.bassLevel = this.calculateAverageLevel(0, bassEnd);
        this.midLevel = this.calculateAverageLevel(bassEnd, midEnd);
        this.highLevel = this.calculateAverageLevel(midEnd, this.bufferLength);
        
        // Detect dominant frequency
        this.currentFrequency = this.detectDominantFrequency();
    }

    calculateAverageLevel(start, end) {
        if (!this.frequencyData.length) return 0;
        
        let sum = 0;
        for (let i = start; i < end && i < this.frequencyData.length; i++) {
            sum += Math.abs(this.frequencyData[i]);
        }
        return sum / (end - start);
    }

    detectDominantFrequency() {
        if (!this.frequencyData.length) return 440;
        
        let maxValue = -Infinity;
        let maxIndex = 0;
        
        // Find the frequency bin with the highest magnitude
        for (let i = 0; i < this.frequencyData.length; i++) {
            if (this.frequencyData[i] > maxValue) {
                maxValue = this.frequencyData[i];
                maxIndex = i;
            }
        }
        
        // Convert bin index to frequency
        const nyquist = this.audioContext.sampleRate / 2;
        const frequency = (maxIndex / this.bufferLength) * nyquist;
        
        return Math.round(frequency);
    }

    getFrequencyRange(frequency) {
        if (frequency < 250) return 'bass';
        if (frequency < 4000) return 'mid';
        return 'high';
    }

    // Get normalized levels (0-1) for game mechanics
    getNormalizedLevels() {
        return {
            bass: Math.min(this.bassLevel * 10, 1), // Amplify for better sensitivity
            mid: Math.min(this.midLevel * 10, 1),
            high: Math.min(this.highLevel * 10, 1),
            frequency: this.currentFrequency
        };
    }

    // Get visual data for spectrum visualization
    getVisualizationData() {
        return {
            frequencyData: this.frequencyData,
            bassLevel: this.bassLevel,
            midLevel: this.midLevel,
            highLevel: this.highLevel,
            currentFrequency: this.currentFrequency
        };
    }

    dispose() {
        if (this.microphone) {
            this.microphone.close();
            this.microphone.dispose();
        }
        if (this.player) {
            this.player.dispose();
        }
        if (this.analyzer) {
            this.analyzer.dispose();
        }
        if (this.freqAnalyzer) {
            this.freqAnalyzer.dispose();
        }
    }
}
