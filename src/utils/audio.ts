/**
 * Customizable Web Audio API Sound & Relaxing Ambient Music Synthesizer for Mnemosine
 */

export type SoundTheme = 'lira' | 'classico' | 'cristal' | 'suave';
export type AmbientTrack = 'medieval' | 'violino' | 'piano' | 'flauta';

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0 to 1
  theme: SoundTheme;
  flipEnabled: boolean;
  matchEnabled: boolean;
  mismatchEnabled: boolean;
  specialEnabled: boolean;
  ambientEnabled: boolean;
  ambientTrack: AmbientTrack;
  ambientVolume: number; // 0 to 1
}

class SoundController {
  private ctx: AudioContext | null = null;
  private ambientTimer: ReturnType<typeof setInterval> | null = null;
  private ambientStep: number = 0;
  private activeTrack: AmbientTrack | null = null;
  private ambientMasterGain: GainNode | null = null;
  private ambientInputNode: GainNode | null = null;
  private breathBuffer: AudioBuffer | null = null;

  public settings: SoundSettings = {
    enabled: true,
    volume: 0.75,
    theme: 'lira',
    flipEnabled: true,
    matchEnabled: true,
    mismatchEnabled: true,
    specialEnabled: true,
    ambientEnabled: false,
    ambientTrack: 'medieval',
    ambientVolume: 0.45
  };

  public get enabled(): boolean {
    return this.settings.enabled;
  }

  public set enabled(val: boolean) {
    this.updateSettings({ enabled: val });
  }

  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<SoundSettings>) {
    const prevTrack = this.settings.ambientTrack;
    const prevRunning = this.settings.enabled && this.settings.ambientEnabled;

    this.settings = { ...this.settings, ...partial };
    const nextRunning = this.settings.enabled && this.settings.ambientEnabled;

    // Smoothly update ambient master volume immediately if already created
    if (this.ctx && this.ambientMasterGain) {
      const targetGain = nextRunning ? Math.max(0.02, this.settings.ambientVolume * 0.85) : 0.0001;
      this.ambientMasterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    }

    if (nextRunning) {
      if (!prevRunning || prevTrack !== this.settings.ambientTrack) {
        this.restartAmbient();
      }
    } else {
      this.stopAmbient();
    }
  }

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Builds a warm chamber-hall echo/reverb bus for relaxing ambient instruments
   */
  private getAmbientDestination(ctx: AudioContext): AudioNode {
    if (this.ambientInputNode && this.ambientMasterGain) {
      return this.ambientInputNode;
    }

    const input = ctx.createGain();
    const master = ctx.createGain();
    const initialGain =
      this.settings.enabled && this.settings.ambientEnabled
        ? Math.max(0.02, this.settings.ambientVolume * 0.85)
        : 0.0001;
    master.gain.setValueAtTime(initialGain, ctx.currentTime);

    // Subtle warm hall echo network
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.36, ctx.currentTime);

    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.28, ctx.currentTime);

    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.setValueAtTime(900, ctx.currentTime);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.34, ctx.currentTime);

    // Dry + Wet routing
    input.connect(master);
    input.connect(delay);
    delay.connect(echoFilter);
    echoFilter.connect(wetGain);
    wetGain.connect(master);
    echoFilter.connect(feedback);
    feedback.connect(delay);

    master.connect(ctx.destination);

    this.ambientInputNode = input;
    this.ambientMasterGain = master;
    return input;
  }

  private getTrackIntervalMs(track: AmbientTrack): number {
    switch (track) {
      case 'medieval':
        return 1150;
      case 'violino':
        return 2150;
      case 'piano':
        return 1380;
      case 'flauta':
      default:
        return 1850;
    }
  }

  public restartAmbient() {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    this.ambientStep = 0;
    this.activeTrack = this.settings.ambientTrack;

    const ctx = this.getContext();
    if (ctx && this.ambientMasterGain) {
      const targetGain = Math.max(0.02, this.settings.ambientVolume * 0.85);
      this.ambientMasterGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
    }

    this.playAmbientStep();
    const intervalMs = this.getTrackIntervalMs(this.settings.ambientTrack);
    this.ambientTimer = setInterval(() => {
      this.playAmbientStep();
    }, intervalMs);
  }

  public stopAmbient() {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    this.activeTrack = null;
    if (this.ctx && this.ambientMasterGain) {
      this.ambientMasterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
    }
  }

  private playAmbientStep() {
    if (!this.settings.enabled || !this.settings.ambientEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const dest = this.getAmbientDestination(ctx);

      switch (this.settings.ambientTrack) {
        case 'medieval':
          this.playMedievalStep(ctx, dest);
          break;
        case 'violino':
          this.playViolinStep(ctx, dest);
          break;
        case 'piano':
          this.playPianoStep(ctx, dest);
          break;
        case 'flauta':
        default:
          this.playFluteStep(ctx, dest);
          break;
      }

      this.ambientStep += 1;
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * 1. MEDIEVAL: Serene Dorian Lute & Harp (D Dorian: D4 E4 F4 G4 A4 B4 C5 D5)
   */
  private playMedievalStep(ctx: AudioContext, dest: AudioNode) {
    const melody = [
      293.66, 440.0, 392.0, 349.23,
      329.63, 349.23, 293.66, 220.0,
      293.66, 349.23, 392.0, 440.0,
      523.25, 440.0, 392.0, 349.23
    ];
    const drones: [number, number][] = [
      [146.83, 220.0], // D3 + A3
      [130.81, 196.0], // C3 + G3
      [146.83, 220.0], // D3 + A3
      [130.81, 196.0]  // C3 + G3
    ];

    const idx = this.ambientStep % melody.length;
    const freq = melody[idx];
    const now = ctx.currentTime;

    this.triggerPluckedLute(ctx, dest, freq, now, 0.095, 1.55);

    // Every 4 notes, pluck a warm medieval open-fifth accompaniment chord
    if (idx % 4 === 0) {
      const [root, fifth] = drones[Math.floor(idx / 4) % drones.length];
      this.triggerPluckedLute(ctx, dest, root, now, 0.065, 3.2);
      this.triggerPluckedLute(ctx, dest, fifth, now + 0.04, 0.05, 3.0);
    }
  }

  private triggerPluckedLute(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    peakGain: number,
    duration: number
  ) {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const overtoneGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, start);
    overtoneGain.gain.setValueAtTime(0.24, start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1650, start);
    filter.frequency.exponentialRampToValueAtTime(480, start + duration * 0.8);

    gain.gain.setValueAtTime(0.0005, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + duration);

    osc.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(start);
    overtone.start(start);
    osc.stop(start + duration + 0.05);
    overtone.stop(start + duration + 0.05);
  }

  /**
   * 2. VIOLINO: Slow Relaxing Chamber Adagio with Warm Bowed Strings & Cello Pad
   */
  private playViolinStep(ctx: AudioContext, dest: AudioNode) {
    // Expressive calming adagio in A minor / F major / C major
    const violinNotes = [
      329.63, 440.0, 392.0, 329.63,
      349.23, 293.66, 329.63, 261.63,
      293.66, 329.63, 246.94, 220.0
    ];
    const celloRoots = [110.0, 174.61, 130.81, 110.0]; // A2, F3/2, C3, A2

    const idx = this.ambientStep % violinNotes.length;
    const freq = violinNotes[idx];
    const now = ctx.currentTime;

    // Solo Violin legato note
    this.triggerBowedString(ctx, dest, freq, now, 0.085, 2.45, true);

    // Warm Cello sustained bass note every 3 steps
    if (idx % 3 === 0) {
      const bassFreq = celloRoots[Math.floor(idx / 3) % celloRoots.length];
      this.triggerBowedString(ctx, dest, bassFreq, now, 0.055, 5.2, false);
    }
  }

  private triggerBowedString(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    peakGain: number,
    duration: number,
    withVibrato: boolean
  ) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const mix2 = ctx.createGain();
    const bodyResonance = ctx.createBiquadFilter();
    const warmLowpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, start);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.002, start); // subtle ensemble warmth
    mix2.gain.setValueAtTime(0.65, start);

    if (withVibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.1, start);
      lfoGain.gain.setValueAtTime(0.1, start);
      lfoGain.gain.linearRampToValueAtTime(2.6, start + 0.7);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      lfo.start(start);
      lfo.stop(start + duration + 0.05);
    }

    bodyResonance.type = 'peaking';
    bodyResonance.frequency.setValueAtTime(520, start);
    bodyResonance.Q.setValueAtTime(1.2, start);
    bodyResonance.gain.setValueAtTime(3.5, start);

    warmLowpass.type = 'lowpass';
    warmLowpass.frequency.setValueAtTime(withVibrato ? 1050 : 420, start);

    // Slow gentle bow attack & long legato fade
    gain.gain.setValueAtTime(0.0005, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.55, duration * 0.3));
    gain.gain.setValueAtTime(peakGain * 0.85, start + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + duration);

    osc1.connect(bodyResonance);
    osc2.connect(mix2);
    mix2.connect(bodyResonance);
    bodyResonance.connect(warmLowpass);
    warmLowpass.connect(gain);
    gain.connect(dest);

    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + duration + 0.06);
    osc2.stop(start + duration + 0.06);
  }

  /**
   * 3. PIANO: Contemplative Soft Felt Piano Nocturne (Satie / Gymnopédie inspired)
   */
  private playPianoStep(ctx: AudioContext, dest: AudioNode) {
    // Lush Fmaj7 -> Cmaj7 -> Dm7 -> Am7 broken sustain-pedal chords
    const arpeggio = [
      174.61, 261.63, 329.63, 440.0,  // F3, C4, E4, A4 (Fmaj7)
      130.81, 196.0, 246.94, 329.63,  // C3, G3, B3, E4 (Cmaj7)
      146.83, 220.0, 261.63, 349.23,  // D3, A3, C4, F4 (Dm7)
      110.0, 196.0, 261.63, 329.63    // A2, G3, C4, E4 (Am7)
    ];

    const idx = this.ambientStep % arpeggio.length;
    const freq = arpeggio[idx];
    const now = ctx.currentTime;
    const isBass = idx % 4 === 0;

    this.triggerFeltPiano(ctx, dest, freq, now, isBass ? 0.11 : 0.095, isBass ? 3.8 : 2.7);
  }

  private triggerFeltPiano(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    peakGain: number,
    duration: number
  ) {
    const fundamental = ctx.createOscillator();
    const overtone2 = ctx.createOscillator();
    const overtone3 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const gain3 = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, start);

    overtone2.type = 'triangle';
    overtone2.frequency.setValueAtTime(freq * 2, start);
    gain2.gain.setValueAtTime(0.18, start);
    gain2.gain.exponentialRampToValueAtTime(0.01, start + duration * 0.5);

    overtone3.type = 'sine';
    overtone3.frequency.setValueAtTime(freq * 3, start);
    gain3.gain.setValueAtTime(0.045, start);
    gain3.gain.exponentialRampToValueAtTime(0.002, start + duration * 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(920, start);
    filter.frequency.exponentialRampToValueAtTime(420, start + duration);

    env.gain.setValueAtTime(0.0005, start);
    env.gain.linearRampToValueAtTime(peakGain, start + 0.02);
    env.gain.exponentialRampToValueAtTime(peakGain * 0.38, start + 0.35);
    env.gain.exponentialRampToValueAtTime(0.0005, start + duration);

    fundamental.connect(filter);
    overtone2.connect(gain2);
    gain2.connect(filter);
    overtone3.connect(gain3);
    gain3.connect(filter);
    filter.connect(env);
    env.connect(dest);

    fundamental.start(start);
    overtone2.start(start);
    overtone3.start(start);
    fundamental.stop(start + duration + 0.05);
    overtone2.stop(start + duration + 0.05);
    overtone3.stop(start + duration + 0.05);
  }

  /**
   * 4. FLAUTA: Soft, Airy Wooden Concert Flute Pastoral Melody with Gentle Breath & Warm Pad
   */
  private getBreathNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.breathBuffer) return this.breathBuffer;
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.breathBuffer = buffer;
    return buffer;
  }

  private playFluteStep(ctx: AudioContext, dest: AudioNode) {
    // Lyrical, deeply soothing F Major / D Minor pentatonic flute melody
    const fluteMelody = [
      349.23, 392.0, 440.0, 523.25,
      587.33, 523.25, 440.0, 392.0,
      440.0, 349.23, 293.66, 349.23,
      392.0, 440.0, 392.0, 349.23
    ];
    const warmPads: [number, number][] = [
      [174.61, 261.63], // F3 + C4
      [146.83, 220.0],  // D3 + A3
      [116.54, 174.61], // Bb2 + F3
      [130.81, 196.0]   // C3 + G3
    ];

    const idx = this.ambientStep % fluteMelody.length;
    const freq = fluteMelody[idx];
    const now = ctx.currentTime;

    this.triggerWoodenFlute(ctx, dest, freq, now, 0.095, 2.25);

    // Every 4 notes, bloom a soft warm harmonic pad underneath the flute
    if (idx % 4 === 0) {
      const [root, fifth] = warmPads[Math.floor(idx / 4) % warmPads.length];
      this.triggerSoftPadNote(ctx, dest, root, now, 0.036, 5.4);
      this.triggerSoftPadNote(ctx, dest, fifth, now, 0.026, 5.4);
    }
  }

  private triggerWoodenFlute(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    peakGain: number,
    duration: number
  ) {
    const fundamental = ctx.createOscillator();
    const overtone2 = ctx.createOscillator();
    const overtone3 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const gain3 = ctx.createGain();
    const toneFilter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    // Gentle natural embouchure pitch articulation into pure flute tone
    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq * 0.993, start);
    fundamental.frequency.exponentialRampToValueAtTime(freq, start + 0.085);

    overtone2.type = 'sine';
    overtone2.frequency.setValueAtTime(freq * 2, start);
    gain2.gain.setValueAtTime(0.14, start);

    overtone3.type = 'sine';
    overtone3.frequency.setValueAtTime(freq * 3, start);
    gain3.gain.setValueAtTime(0.032, start);

    // Delayed natural flute breath vibrato
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(4.6, start);
    lfoGain.gain.setValueAtTime(0.05, start);
    lfoGain.gain.linearRampToValueAtTime(2.1, start + 0.55);
    lfo.connect(lfoGain);
    lfoGain.connect(fundamental.frequency);
    lfo.start(start);
    lfo.stop(start + duration + 0.05);

    // Velvety flute air whisper ("chiff") on gentle breath attack
    const noise = ctx.createBufferSource();
    noise.buffer = this.getBreathNoiseBuffer(ctx);
    const breathBand = ctx.createBiquadFilter();
    breathBand.type = 'bandpass';
    breathBand.frequency.setValueAtTime(freq * 1.5, start);
    breathBand.Q.setValueAtTime(5.5, start);
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0002, start);
    breathGain.gain.linearRampToValueAtTime(0.012, start + 0.07);
    breathGain.gain.exponentialRampToValueAtTime(0.0002, start + 0.35);
    noise.connect(breathBand);
    breathBand.connect(breathGain);
    breathGain.connect(dest);
    noise.start(start);
    noise.stop(start + 0.4);

    toneFilter.type = 'lowpass';
    toneFilter.frequency.setValueAtTime(1300, start);

    // Smooth singing breath envelope
    env.gain.setValueAtTime(0.0005, start);
    env.gain.linearRampToValueAtTime(peakGain, start + 0.28);
    env.gain.setValueAtTime(peakGain * 0.88, start + duration * 0.58);
    env.gain.exponentialRampToValueAtTime(0.0005, start + duration);

    fundamental.connect(toneFilter);
    overtone2.connect(gain2);
    gain2.connect(toneFilter);
    overtone3.connect(gain3);
    gain3.connect(toneFilter);
    toneFilter.connect(env);
    env.connect(dest);

    fundamental.start(start);
    overtone2.start(start);
    overtone3.start(start);
    fundamental.stop(start + duration + 0.06);
    overtone2.stop(start + duration + 0.06);
    overtone3.stop(start + duration + 0.06);
  }

  private triggerSoftPadNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    peakGain: number,
    duration: number
  ) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    env.gain.setValueAtTime(0.0005, start);
    env.gain.linearRampToValueAtTime(peakGain, start + 0.9);
    env.gain.setValueAtTime(peakGain * 0.8, start + duration * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0005, start + duration);

    osc.connect(env);
    env.connect(dest);

    osc.start(start);
    osc.stop(start + duration + 0.06);
  }

  private getOscType(): OscillatorType {
    switch (this.settings.theme) {
      case 'lira':
        return 'triangle';
      case 'cristal':
        return 'sine';
      case 'suave':
        return 'sine';
      case 'classico':
      default:
        return 'sine';
    }
  }

  private getPitchMultiplier(): number {
    switch (this.settings.theme) {
      case 'lira':
        return 1.0;
      case 'cristal':
        return 1.35;
      case 'suave':
        return 0.75;
      case 'classico':
      default:
        return 1.0;
    }
  }

  public playFlip() {
    if (!this.settings.enabled || !this.settings.flipEnabled) return;
    const vol = Math.max(0.005, this.settings.volume * 0.12);
    const mult = this.getPitchMultiplier();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.getOscType();
      if (this.settings.theme === 'lira') {
        osc.frequency.setValueAtTime(392 * mult, now);
        osc.frequency.exponentialRampToValueAtTime(587.33 * mult, now + 0.11);
      } else {
        osc.frequency.setValueAtTime(420 * mult, now);
        osc.frequency.exponentialRampToValueAtTime(760 * mult, now + 0.08);
      }

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Ignore audio failure
    }
  }

  public playMatch() {
    if (!this.settings.enabled || !this.settings.matchEnabled) return;
    const vol = Math.max(0.005, this.settings.volume * 0.16);
    const mult = this.getPitchMultiplier();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes =
        this.settings.theme === 'lira'
          ? [440.0, 554.37, 659.25, 880.0]
          : [523.25, 659.25, 783.99, 1046.5];

      notes.forEach((baseFreq, idx) => {
        const freq = baseFreq * mult;
        const start = ctx.currentTime + idx * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = this.settings.theme === 'classico' ? 'triangle' : this.getOscType();
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {
      // Ignore audio failure
    }
  }

  public playMismatch() {
    if (!this.settings.enabled || !this.settings.mismatchEnabled) return;
    const vol = Math.max(0.005, this.settings.volume * 0.09);
    const mult = this.getPitchMultiplier();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.settings.theme === 'classico' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(240 * mult, now);
      osc.frequency.exponentialRampToValueAtTime(155 * mult, now + 0.2);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.21);
    } catch {
      // Ignore audio failure
    }
  }

  public playPeek() {
    if (!this.settings.enabled || !this.settings.specialEnabled) return;
    const vol = Math.max(0.005, this.settings.volume * 0.12);
    const mult = this.getPitchMultiplier();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = this.getOscType();
      osc.frequency.setValueAtTime(320 * mult, now);
      osc.frequency.exponentialRampToValueAtTime(880 * mult, now + 0.3);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.33);
    } catch {
      // Ignore audio failure
    }
  }

  public playVictory() {
    if (!this.settings.enabled || !this.settings.specialEnabled) return;
    const vol = Math.max(0.005, this.settings.volume * 0.18);
    const mult = this.getPitchMultiplier();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((baseFreq, idx) => {
        const freq = baseFreq * mult;
        const start = ctx.currentTime + idx * 0.095;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = this.getOscType();
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.005, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.52);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.55);
      });
    } catch {
      // Ignore audio failure
    }
  }
}

export const sounds = new SoundController();
