import { buildSongChart, BeatMap } from './rhythm'

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
  private countInNodes: OscillatorNode[] = []
  private metronomeNodes = new Set<OscillatorNode>()
  private metronomeEnabled = false
  private metronomeCursor = 0
  private beatCalibration = 0
  private data = new Uint8Array(1024)
  private bands = new Float32Array(64)
  private levels = { bass: 0, mid: 0, high: 0 }

  get duration() { return this.buffer?.duration || 0 }
  get hasAudio() { return !!this.buffer }
  get isPlaying() { return this.playing }
  get currentTime() {
    return Math.max(0, Math.min(this.duration, this.offset + (this.playing && this.context ? this.context.currentTime - this.startedAt : 0)))
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

  async loadAudio(data: ArrayBuffer, bpm?: number, chart?: BeatMap) {
    await this.initialize()
    const buffer = await this.context!.decodeAudioData(data)
    if (this.disposed) throw new Error('Audio player has been closed.')
    const validChart = chart?.version === 3 && chart.beats?.length > 0 && Number.isFinite(chart.bpm) && chart.bpm > 0
      && Math.abs((chart.duration || 0) - buffer.duration) < 0.2
      && chart.beats.every((time, index) => Number.isFinite(time) && time >= 0 && time < chart.duration! && (index === 0 || time > chart.beats[index - 1]))
      && chart.notes?.every((time, index) => Number.isFinite(time) && time >= 0 && time < chart.duration! && (index === 0 || time > chart.notes![index - 1]))
    // MP3 decoders can disagree slightly on end padding. A compatible chart
    // keeps its phase; only timestamps beyond the decoded end are trimmed.
    let beatMap: BeatMap | undefined = validChart ? { ...chart!, duration: buffer.duration,
      beats: chart!.beats.filter(time => time < buffer.duration),
      notes: chart!.notes!.filter(time => time < buffer.duration)
    } : undefined
    if (!validChart) {
      // Stored charts avoid scanning the recording again. Uploads average stereo
      // channels for analysis without changing the playback recording.
      const samples = new Float32Array(buffer.length)
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const values = buffer.getChannelData(channel)
        for (let i = 0; i < values.length; i++) samples[i] += values[i] / buffer.numberOfChannels
      }
      beatMap = buildSongChart(samples, buffer.sampleRate, bpm)
    }
    this.stopPlayback()
    this.buffer = buffer
    this.offset = 0
    this.beatMap = beatMap!
  }

  async loadAudioFile(file: File) { await this.loadAudio(await file.arrayBuffer()); return true }

  async startPlayback(delay = 0, countIn = false) {
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
    this.startedAt = this.context!.currentTime + delay
    this.playing = true
    this.resetMetronomeCursor()
    source.onended = () => {
      if (this.source !== source) return
      this.offset = this.duration
      this.playing = false
      source.disconnect()
      this.source = null
      this.clearMetronome()
    }
    source.start(this.startedAt, this.offset)
    if (countIn && delay > 0) {
      const period = 60 / this.beatMap.bpm
      const phase = ((this.beatMap.offset % period) + period) % period - this.beatCalibration
      for (let beat = 4; beat >= 1; beat--) {
        const at = this.startedAt + phase - beat * period
        if (at < this.context!.currentTime + 0.01) continue
        this.countInNodes.push(this.scheduleClick(at, beat === 4))
      }
    }
  }

  private scheduleClick(at: number, accent: boolean, metronome = false) {
    const oscillator = this.context!.createOscillator()
    const gain = this.context!.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = accent ? 1100 : 750
    gain.gain.setValueAtTime(metronome ? 0.1 : 0.16, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.04)
    oscillator.connect(gain); gain.connect(this.gain!)
    oscillator.start(at); oscillator.stop(at + 0.05)
    oscillator.onended = () => {
      oscillator.disconnect(); gain.disconnect()
      this.metronomeNodes.delete(oscillator)
      this.countInNodes = this.countInNodes.filter(node => node !== oscillator)
    }
    return oscillator
  }

  private clearMetronome() {
    for (const node of this.metronomeNodes) { try { node.stop() } catch {} }
    this.metronomeNodes.clear()
  }
  private resetMetronomeCursor() {
    if (!this.context) return
    const time = this.offset + this.context.currentTime - this.startedAt + this.beatCalibration
    const index = this.beatMap.beats.findIndex(beat => beat >= time + 0.005)
    this.metronomeCursor = index < 0 ? this.beatMap.beats.length : index
  }
  setMetronome(enabled: boolean, calibrationMs = 0) {
    if (this.metronomeEnabled === enabled && this.beatCalibration === calibrationMs / 1000) return
    this.metronomeEnabled = enabled
    this.beatCalibration = calibrationMs / 1000
    this.clearMetronome(); this.resetMetronomeCursor()
  }
  private scheduleMetronome() {
    if (!this.metronomeEnabled || !this.playing || !this.context) return
    const now = this.context.currentTime
    while (this.metronomeCursor < this.beatMap.beats.length) {
      const index = this.metronomeCursor
      const at = this.startedAt + this.beatMap.beats[index] - this.offset - this.beatCalibration
      if (at > now + 0.15) break
      this.metronomeCursor++
      if (at >= now + 0.001) this.metronomeNodes.add(this.scheduleClick(at, index % (this.beatMap.beatsPerBar || 4) === 0, true))
    }
  }

  // Translate a pointer event's performance timestamp into the audio that was
  // reaching the output device at that instant, independent of animation FPS.
  timeAt(performanceTime = performance.now()) {
    if (!this.context || !this.playing) return this.offset
    const timestamp = this.context.getOutputTimestamp?.()
    let audibleContext: number
    if (timestamp?.performanceTime > 0 && timestamp.contextTime > 0) {
      audibleContext = timestamp.contextTime + (performanceTime - timestamp.performanceTime) / 1000
    } else {
      const latency = (this.context.baseLatency || 0) + (this.context.outputLatency || 0)
      audibleContext = this.context.currentTime - latency + (performanceTime - performance.now()) / 1000
    }
    return this.offset + audibleContext - this.startedAt
  }

  stopPlayback() {
    this.playbackVersion++
    this.offset = this.currentTime
    this.playing = false
    for (const oscillator of this.countInNodes) { try { oscillator.stop() } catch {} }
    this.countInNodes = []
    this.clearMetronome()
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
    this.scheduleMetronome()
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
