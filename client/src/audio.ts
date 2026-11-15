type SceneName = "title" | "lobby" | "design" | "launch" | "mission" | "debrief";

const MUTE_KEY = "red-frontier-muted";

class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceStarted = false;
  private muted = false;
  private scene: SceneName = "title";
  private telemetryTimer: number | null = null;
  private scanNodes: { oscillator: OscillatorNode; gain: GainNode } | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      const Ctor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const context = new Ctor();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.28;
      this.master.connect(context.destination);
      this.ambientGain = context.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientGain.connect(this.master);
      this.sfxGain = context.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.master);
      this.noiseBuffer = this.createNoiseBuffer(context);
      this.startAmbience();
      this.startTelemetry();
    }
    if (this.context.state === "suspended") {
      await this.context.resume().catch(() => undefined);
    }
    this.applySceneGain();
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      // Local storage can be unavailable; the audio state still works for this session.
    }
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(
        this.muted ? 0 : 0.28,
        this.context.currentTime + 0.08,
      );
    }
    return this.muted;
  }

  setScene(scene: SceneName): void {
    this.scene = scene;
    this.applySceneGain();
  }

  click(): void {
    this.tone(620, 0.028, "square", 0.03, 760);
  }

  select(): void {
    this.tone(420, 0.045, "triangle", 0.05, 520);
    this.tone(630, 0.055, "triangle", 0.035, 720, 0.035);
  }

  confirm(): void {
    this.tone(392, 0.08, "triangle", 0.05);
    this.tone(523, 0.1, "triangle", 0.05, undefined, 0.06);
    this.tone(784, 0.16, "sine", 0.035, undefined, 0.13);
  }

  denied(): void {
    this.tone(170, 0.08, "square", 0.035);
    this.tone(120, 0.12, "square", 0.025, undefined, 0.08);
  }

  scanStart(): void {
    if (!this.context || !this.sfxGain || this.scanNodes) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 240;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(this.sfxGain);
    oscillator.start();
    const now = this.context.currentTime;
    gain.gain.linearRampToValueAtTime(0.018, now + 0.1);
    oscillator.frequency.linearRampToValueAtTime(420, now + 0.55);
    this.scanNodes = { oscillator, gain };
  }

  scanStop(): void {
    if (!this.context || !this.scanNodes) return;
    const { oscillator, gain } = this.scanNodes;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    oscillator.stop(now + 0.1);
    this.scanNodes = null;
  }

  complete(): void {
    this.tone(523, 0.09, "triangle", 0.05);
    this.tone(659, 0.09, "triangle", 0.045, undefined, 0.07);
    this.tone(880, 0.22, "sine", 0.04, undefined, 0.15);
  }

  eventAlert(): void {
    this.tone(196, 0.1, "square", 0.035);
    this.tone(246, 0.1, "square", 0.035, undefined, 0.18);
    this.tone(196, 0.16, "square", 0.035, undefined, 0.36);
  }

  ability(): void {
    this.tone(330, 0.08, "sine", 0.04, 660);
    this.tone(990, 0.14, "triangle", 0.025, undefined, 0.08);
  }

  launch(): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    if (this.noiseBuffer) {
      source.buffer = this.noiseBuffer;
      source.loop = true;
    }
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    filter.Q.value = 0.8;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.16, now + 1.2);
    gain.gain.setValueAtTime(0.16, now + 3.4);
    gain.gain.linearRampToValueAtTime(0, now + 6.2);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
    source.stop(now + 6.4);
    this.tone(58, 4.4, "sine", 0.09, 84);
  }

  touchdown(): void {
    if (!this.context || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
    source.stop(now + 0.9);
    this.tone(92, 0.3, "sine", 0.06, 44);
  }

  success(): void {
    const notes = [392, 523, 659, 784, 1046];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.24, "triangle", 0.045, undefined, index * 0.13);
    });
  }

  failure(): void {
    const notes = [196, 174, 146, 98];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.32, "sawtooth", 0.03, undefined, index * 0.17);
    });
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.04,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.context || !this.sfxGain || this.muted) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.linearRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private startAmbience(): void {
    if (!this.context || !this.ambientGain || this.ambienceStarted) return;
    this.ambienceStarted = true;
    const now = this.context.currentTime;
    const drone = this.context.createGain();
    drone.gain.value = 0.03;
    drone.connect(this.ambientGain);

    const low = this.context.createOscillator();
    low.type = "sine";
    low.frequency.value = 49;
    const lowGain = this.context.createGain();
    lowGain.gain.value = 0.65;
    low.connect(lowGain);
    lowGain.connect(drone);
    low.start(now);

    const mid = this.context.createOscillator();
    mid.type = "triangle";
    mid.frequency.value = 73.5;
    const midFilter = this.context.createBiquadFilter();
    midFilter.type = "lowpass";
    midFilter.frequency.value = 220;
    const midGain = this.context.createGain();
    midGain.gain.value = 0.25;
    mid.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(drone);
    mid.start(now);

    if (this.noiseBuffer) {
      const noise = this.context.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      const noiseFilter = this.context.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 640;
      noiseFilter.Q.value = 0.35;
      const noiseGain = this.context.createGain();
      noiseGain.gain.value = 0.055;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ambientGain);
      noise.start(now);
    }

    this.applySceneGain();
  }

  private startTelemetry(): void {
    if (this.telemetryTimer !== null) return;
    this.telemetryTimer = window.setInterval(() => {
      if (this.muted) return;
      if (this.scene === "launch" || this.scene === "mission") {
        this.tone(1320, 0.035, "sine", 0.008, undefined, 0);
      }
    }, 7900);
  }

  private applySceneGain(): void {
    if (!this.context || !this.ambientGain) return;
    const levels: Record<SceneName, number> = {
      title: 0.32,
      lobby: 0.46,
      design: 0.42,
      launch: 0.8,
      mission: 0.58,
      debrief: 0.25,
    };
    const now = this.context.currentTime;
    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.linearRampToValueAtTime(levels[this.scene], now + 0.6);
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[index] = last;
    }
    return buffer;
  }
}

export const audio = new AudioDirector();
