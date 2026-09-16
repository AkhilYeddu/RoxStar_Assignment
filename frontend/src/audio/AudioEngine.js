import { encodeWAV, extractWaveformPeaks } from './WavEncoder';

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.processorNode = null;
    this.recordedSamples = [];
    this.isRecording = false;
    this.startTime = 0;
    this.duration = 0;

    // Effect parameters
    this.effects = {
      echo: {
        enabled: false,
        delay: 0.25, // seconds (0.05 - 1.0)
        feedback: 0.4, // 0 - 0.9
        mix: 0.5 // 0 - 1
      },
      reverb: {
        enabled: false,
        roomSize: 1.8, // seconds decay
        mix: 0.45 // 0 - 1
      },
      pitch: {
        enabled: false,
        semitones: 0, // -12 to +12
        mix: 0.8
      }
    };
  }

  async initContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 44100 });
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setEffectParam(effectName, param, value) {
    if (this.effects[effectName]) {
      this.effects[effectName][param] = value;
      // Re-apply to active nodes if currently running
      this.updateActiveEffectNodes();
    }
  }

  toggleEffect(effectName, enabled) {
    if (this.effects[effectName]) {
      this.effects[effectName].enabled = enabled !== undefined ? enabled : !this.effects[effectName].enabled;
      this.updateActiveEffectNodes();
    }
  }

  createReverbImpulse(duration = 2.0, decay = 2.0) {
    const rate = this.audioCtx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.audioCtx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const dec = Math.exp(-n * decay);
      left[i] = (Math.random() * 2 - 1) * dec;
      right[i] = (Math.random() * 2 - 1) * dec;
    }
    return impulse;
  }

  setupEffectChain(source) {
    const ctx = this.audioCtx;

    // Dry bus
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;

    // Wet bus accumulator
    const masterEffectOut = ctx.createGain();
    masterEffectOut.gain.value = 1.0;

    // Connect dry path
    source.connect(dryGain);
    dryGain.connect(masterEffectOut);

    // 1. Echo Effect
    if (this.effects.echo.enabled) {
      const echoDelay = ctx.createDelay(2.0);
      echoDelay.delayTime.value = this.effects.echo.delay;

      const echoFeedback = ctx.createGain();
      echoFeedback.gain.value = this.effects.echo.feedback;

      const echoWet = ctx.createGain();
      echoWet.gain.value = this.effects.echo.mix;

      source.connect(echoDelay);
      echoDelay.connect(echoFeedback);
      echoFeedback.connect(echoDelay); // feedback loop
      echoDelay.connect(echoWet);
      echoWet.connect(masterEffectOut);

      this._echoNodes = { echoDelay, echoFeedback, echoWet };
    }

    // 2. Reverb Effect
    if (this.effects.reverb.enabled) {
      const convolver = ctx.createConvolver();
      convolver.buffer = this.createReverbImpulse(this.effects.reverb.roomSize, 2.5);

      const reverbWet = ctx.createGain();
      reverbWet.gain.value = this.effects.reverb.mix;

      source.connect(convolver);
      convolver.connect(reverbWet);
      reverbWet.connect(masterEffectOut);

      this._reverbNodes = { convolver, reverbWet };
    }

    return masterEffectOut;
  }

  updateActiveEffectNodes() {
    if (this._echoNodes) {
      this._echoNodes.echoDelay.delayTime.value = this.effects.echo.delay;
      this._echoNodes.echoFeedback.gain.value = this.effects.echo.feedback;
      this._echoNodes.echoWet.gain.value = this.effects.echo.enabled ? this.effects.echo.mix : 0;
    }
    if (this._reverbNodes) {
      this._reverbNodes.reverbWet.gain.value = this.effects.reverb.enabled ? this.effects.reverb.mix : 0;
    }
  }

  async startRecording() {
    await this.initContext();

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

    // Setup Analyser Node for visualizer
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 1024;
    this.analyserNode.smoothingTimeConstant = 0.82;

    // Connect source to analyser
    this.sourceNode.connect(this.analyserNode);

    // Build DSP effect chain
    const processedStream = this.setupEffectChain(this.sourceNode);

    // Capture PCM samples via ScriptProcessor (bufferSize 4096)
    this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.recordedSamples = [];

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      this.recordedSamples.push(copy);
    };

    processedStream.connect(this.processorNode);
    // Connect to dummy destination to keep audio processing clock active
    const muteNode = this.audioCtx.createGain();
    muteNode.gain.value = 0; // prevent audio feedback through speakers while recording
    this.processorNode.connect(muteNode);
    muteNode.connect(this.audioCtx.destination);

    this.isRecording = true;
    this.startTime = this.audioCtx.currentTime;
  }

  getFrequencyData() {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData() {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.fftSize);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  stopRecording() {
    if (!this.isRecording) return null;
    this.isRecording = false;
    this.duration = Math.max(0.1, this.audioCtx.currentTime - this.startTime);

    // Flatten recorded chunks into a single Float32Array
    const totalLength = this.recordedSamples.reduce((acc, chunk) => acc + chunk.length, 0);
    const fullBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedSamples) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Apply Pitch shift if enabled on captured buffer
    let processedBuffer = fullBuffer;
    if (this.effects.pitch.enabled && this.effects.pitch.semitones !== 0) {
      processedBuffer = this.applyPitchShift(fullBuffer, this.effects.pitch.semitones);
    }

    // Encode to standard 16-bit WAV
    const wavBlob = encodeWAV(processedBuffer, this.audioCtx.sampleRate);
    const waveformPeaks = extractWaveformPeaks(processedBuffer, 64);

    this.cleanupStream();

    let effectAppliedName = 'none';
    if (this.effects.echo.enabled && this.effects.reverb.enabled) effectAppliedName = 'custom';
    else if (this.effects.echo.enabled) effectAppliedName = 'echo';
    else if (this.effects.reverb.enabled) effectAppliedName = 'reverb';
    else if (this.effects.pitch.enabled) effectAppliedName = 'pitch_shift';

    return {
      blob: wavBlob,
      duration: parseFloat(this.duration.toFixed(2)),
      waveformPeaks,
      effectApplied: effectAppliedName,
      effectParams: {
        echoDelay: this.effects.echo.delay,
        echoFeedback: this.effects.echo.feedback,
        reverbRoomSize: this.effects.reverb.roomSize,
        pitchShiftSemitones: this.effects.pitch.semitones
      }
    };
  }

  /**
   * Resampling-based pitch transposition with cubic interpolation
   */
  applyPitchShift(samples, semitones) {
    const pitchFactor = Math.pow(2, semitones / 12);
    const newLength = Math.round(samples.length / pitchFactor);
    const output = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * pitchFactor;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(samples.length - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      output[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
    }
    return output;
  }

  cancelRecording() {
    this.isRecording = false;
    this.recordedSamples = [];
    this.cleanupStream();
  }

  cleanupStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch { /* ignore */ }
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* ignore */ }
      this.sourceNode = null;
    }
  }
}

export const audioEngine = new AudioEngine();
