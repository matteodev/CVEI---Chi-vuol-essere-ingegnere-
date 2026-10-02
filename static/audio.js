// Audio locale opzionale; sintesi originale come fallback per ogni traccia mancante.
export class StudioAudio {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.timer = null;
    this.step = 0;
    this.level = 1;
    this.tracks = {};
    this.buffers = new Map();
    this.sources = new Set();
    this.musicSource = null;
    this.assetsLoading = null;
    this.activation = 0;
  }
  async loadConfig(configUrl = './audio-config.json') {
    try {
      const response = await fetch(configUrl);
      if (!response.ok) return;
      const config = await response.json();
      for (const key of ['music', 'select', 'help', 'switch', 'suspense', 'correct', 'wrong', 'win']) {
        const path = key === 'music' ? config.music : config.effects?.[key];
        if (typeof path !== 'string' || !path.trim()) continue;
        const url = new URL(path, response.url);
        if (url.origin === location.origin) this.tracks[key] = url.href;
      }
    } catch (error) {
      console.warn('Configurazione audio non disponibile: uso della sintesi.', error);
    }
  }
  async loadAssets() {
    if (!this.assetsLoading) {
      this.assetsLoading = Promise.all(Object.entries(this.tracks).map(async ([key, url]) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          let data;
          try {
            const response = await fetch(url, {signal: controller.signal});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.arrayBuffer();
          } finally { clearTimeout(timeout); }
          const buffer = await this.context.decodeAudioData(data);
          this.buffers.set(key, buffer);
        } catch (error) {
          console.warn(`Traccia ${key} non disponibile: uso della sintesi.`, error);
        }
      }));
    }
    await this.assetsLoading;
  }
  playTrack(name, loop = false) {
    if (!this.enabled || !this.buffers.has(name)) return false;
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(name);
    source.loop = loop;
    const gain = this.context.createGain();
    gain.gain.value = loop ? 0.35 : 0.8;
    source.connect(gain);
    gain.connect(this.master);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
    if (loop) this.musicSource = source;
    return true;
  }
  async enable() {
    const activation = ++this.activation;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.28;
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      await this.context.resume();
      await this.loadAssets();
      if (activation !== this.activation) return false;
      this.enabled = true;
      this.master.gain.setTargetAtTime(0.28, this.context.currentTime, 0.08);
      this.startMusic();
      return true;
    } catch { this.enabled = false; return false; }
  }
  disable() {
    this.activation++;
    this.enabled = false;
    clearInterval(this.timer);
    this.timer = null;
    this.sources.forEach(source => { try { source.stop(); } catch {} });
    this.sources.clear();
    this.musicSource = null;
    if (this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.04);
    }
  }
  tone(frequency, duration = 0.4, delay = 0, type = 'sine', volume = 0.16) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const t = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(volume, t + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.05);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  startMusic() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.musicSource) { try { this.musicSource.stop(); } catch {} this.musicSource = null; }
    if (this.playTrack('music', true)) return;
    const tick = () => {
      if (!this.enabled || document.hidden) return;
      const progression = [110, 87.31, 130.81, 98];
      const root = progression[Math.floor(this.step / 16) % progression.length];
      if (this.step % 8 === 0) {
        [root, root * 1.5, root * 2].forEach((f, i) => this.tone(f, 3.7, i * 0.035, 'sine', 0.055));
      }
      const pattern = [2, 3, 4, 3, 2, 3, 4.5, 3];
      if (this.step % 2 === 0 || this.level > 10) this.tone(root * pattern[this.step % 8], 0.7, 0, 'sine', 0.045);
      if (this.step % 4 === 0) this.tone(55, 0.17, 0, 'triangle', 0.10);
      this.step++;
    };
    tick();
    this.timer = setInterval(tick, 320);
  }
  cue(name) {
    if (this.playTrack(name)) return;
    if (name === 'select') this.tone(660, 0.16, 0, 'sine', 0.16);
    if (name === 'help') [330, 440, 660].forEach((f, i) => this.tone(f, 0.4, i * 0.09));
    if (name === 'switch') [880, 660, 440, 330, 660].forEach((f, i) => this.tone(f, 0.3, i * 0.07));
    if (name === 'suspense') [110, 116.54, 220, 233.08].forEach((f, i) => this.tone(f, 1.2, i * 0.15, 'triangle', 0.10));
    if (name === 'correct') [261.63, 329.63, 392, 523.25].forEach((f, i) => this.tone(f, 0.9, i * 0.13, 'triangle', 0.17));
    if (name === 'wrong') [220, 207.65, 146.83, 110].forEach((f, i) => this.tone(f, 1, i * 0.16, 'triangle', 0.14));
    if (name === 'win') [261.63, 329.63, 392, 523.25, 392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 1.5, i * 0.17, 'triangle', 0.2));
  }
}
