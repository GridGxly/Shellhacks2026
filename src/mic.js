import { PitchEngine, DEFAULT_FFT_SIZE } from './pitch-engine.js';
import { PitchStabilizer } from './stabilizer.js';

/**
 * Live microphone pitch detection. Browser audio "enhancements" are disabled
 * because noise suppression and AGC both reshape a sustained instrument tone
 * enough to disturb pitch tracking.
 */
export class MicPitchTracker {
  /**
   * @param {{fftSize?: number, clarityThreshold?: number, onReading?: (reading: {accepted: boolean, frequency: number|null, clarity: number, rms: number, timestamp: number, stableNote: string|null, stableFreq: number|null}) => void}} [options]
   */
  constructor({ fftSize = DEFAULT_FFT_SIZE, clarityThreshold, onReading } = {}) {
    this.fftSize = fftSize;
    this.clarityThreshold = clarityThreshold;
    this.onReading = onReading;
    this.running = false;
    this.stream = null;
    this.audioContext = null;
    this.rafId = null;
  }

  async start() {
    if (this.running) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();

    const source = this.audioContext.createMediaStreamSource(this.stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = this.fftSize;
    // The default smoothing applies to frequency-domain reads; we take
    // time-domain data, but set it to 0 to make the intent explicit.
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);

    this.analyser = analyser;
    this.engine = new PitchEngine({
      bufferSize: analyser.fftSize,
      clarityThreshold: this.clarityThreshold,
    });
    this.stabilizer = new PitchStabilizer();
    this.buffer = new Float32Array(analyser.fftSize);
    this.running = true;

    const loop = () => {
      if (!this.running) return;
      this.analyser.getFloatTimeDomainData(this.buffer);
      const reading = this.engine.analyze(this.buffer, this.audioContext.sampleRate);
      const settled = this.stabilizer.push(reading);
      this.onReading?.({
        ...reading,
        timestamp: performance.now(),
        stableNote: settled?.noteName ?? null,
        stableFreq: settled?.frequency ?? null,
      });
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);

    return { sampleRate: this.audioContext.sampleRate, fftSize: analyser.fftSize };
  }

  async stop() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}
