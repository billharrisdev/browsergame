export class AudioProcessor {
  public isInitialized = false
  public player: any = null

  async initialize() {
    this.isInitialized = true
  }
  async startMicrophone() {}
  startPlayback() {}
  stopPlayback() {}
  dispose() {}
  update() {}
  getVisualizationData() { return { frequencyData: new Float32Array(32) } }
  getNormalizedLevels() { return { bass: 0, mid: 0, high: 0 } }
  getFrequencyRange(freq: number) { return 'mid' as const }
  async loadAudioFile(file: File) { return true }
}
