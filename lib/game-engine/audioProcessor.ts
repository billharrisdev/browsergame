import { analyzeBeats, BeatMap } from './rhythm'

export class AudioProcessor {
  public isInitialized = false
  public beatMap: BeatMap = { bpm: 120, offset: 0, confidence: 0, beats: [] }
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private startedAt = 0
  private offset = 0
  private playing = false
  private playbackVersion = 0
  private disposed = false
  private data = new Uint8Array(1024)
  private bands = new Float32Array(64)
  private levels = { bass: 0, mid: 0, high: 0 }

  get duration() { return this.buffer?.duration || 0 }
  get hasAudio() { return !!this.buffer }
  get currentTime() {
    return Math.min(this.duration, this.offset + (this.playing && this.context ? this.context.currentTime - this.startedAt : 0))
  }
  get ended() { return this.hasAudio && this.currentTime >= this.duration }

  async initialize() {
    if (this.disposed) throw new Error('Audio player has been closed.')
    if (!this.context) {
      this.context = new AudioContext()
      this.analyser = this.context.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.65
      this.gain = this.context.createGain()
      this.gain.gain.value = 0.65
      this.analyser.connect(this.gain)
      this.gain.connect(this.context.destination)
      this.isInitialized = true
    }
    await this.context.resume()
  }

  async loadAudio(data: ArrayBuffer, bpm?: number) {
    await this.initialize()
    const buffer = await this.context!.decodeAudioData(data)
    if (this.disposed) throw new Error('Audio player has been closed.')
    // Average stereo channels for analysis without changing playback.
    const samples = new Float32Array(buffer.length)
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const values = buffer.getChannelData(channel)
      for (let i = 0; i < values.length; i++) samples[i] += values[i] / buffer.numberOfChannels
    }
    this.stopPlayback()
    this.buffer = buffer
    this.offset = 0
    this.beatMap = analyzeBeats(samples, buffer.sampleRate, bpm)
  }

  async loadAudioFile(file: File) { await this.loadAudio(await file.arrayBuffer()); return true }

  async startPlayback() {
    const version = this.playbackVersion
    await this.initialize()
    if (this.disposed || version !== this.playbackVersion) return
    if (!this.buffer) throw new Error('Choose a song first.')
    if (this.playing) return
    if (this.offset >= this.duration) this.offset = 0
    const source = this.context!.createBufferSource()
    source.buffer = this.buffer
    source.connect(this.analyser!)
    this.source = source
    this.startedAt = this.context!.currentTime
    this.playing = true
    source.onended = () => {
      if (this.source !== source) return
      this.offset = this.duration
      this.playing = false
      source.disconnect()
      this.source = null
    }
    source.start(0, this.offset)
  }

  stopPlayback() {
    this.playbackVersion++
    this.offset = this.currentTime
    this.playing = false
    if (this.source) {
      this.source.onended = null
      this.source.stop()
      this.source.disconnect()
      this.source = null
    }
  }

  rewind() { this.stopPlayback(); this.offset = 0 }
  setVolume(volume: number) {
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.context.currentTime, 0.03)
  }

  update() {
    if (!this.analyser || !this.context) return
    this.analyser.getByteFrequencyData(this.data)
    const binHz = this.context.sampleRate / this.analyser.fftSize
    const average = (low: number, high: number) => {
      const start = Math.max(1, Math.floor(low / binHz))
      const end = Math.min(this.data.length, Math.ceil(high / binHz))
      let sum = 0
      for (let i = start; i < end; i++) sum += this.data[i] / 255
      return sum / Math.max(1, end - start)
    }
    this.levels = { bass: average(30, 250), mid: average(250, 4000), high: average(4000, 16000) }
    for (let i = 0; i < this.bands.length; i++) {
      const frequency = 30 * Math.pow(16000 / 30, i / (this.bands.length - 1))
      this.bands[i] = this.data[Math.min(this.data.length - 1, Math.round(frequency / binHz))] / 255
    }
  }

  getVisualizationData() { return this.bands }
  getNormalizedLevels() { return this.levels }
  dispose() {
    this.stopPlayback()
    this.disposed = true
    void this.context?.close()
    this.context = null
    this.buffer = null
    this.isInitialized = false
  }
}
