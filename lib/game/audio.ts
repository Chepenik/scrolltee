export class ArcadeAudio {
  private context: AudioContext | null = null;

  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  playHit(power: number) {
    this.unlock();
    this.tone(90 + power * 90, 0.045, "square", 0.11);
    window.setTimeout(() => this.tone(190 + power * 340, 0.08, "sawtooth", 0.07), 38);
  }

  playBounce(intensity = 0.5) {
    this.unlock();
    this.tone(110 + intensity * 90, 0.035, "triangle", 0.04 + intensity * 0.05);
  }

  playCup() {
    this.unlock();
    this.tone(520, 0.08, "sine", 0.08);
    window.setTimeout(() => this.tone(780, 0.11, "sine", 0.07), 90);
    window.setTimeout(() => this.tone(1040, 0.16, "triangle", 0.08), 190);
  }

  playUi() {
    this.unlock();
    this.tone(420, 0.04, "sine", 0.035);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
