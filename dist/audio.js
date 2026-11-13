/* Original, local Web Audio cues. Audio is created only after a user gesture. */
(function (global) {
  'use strict';
  const boundedVolume = (value, fallback = .65) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  class HexAudio {
    constructor({sfx = false, music = false, volume = .65} = {}) {
      this.sfx = sfx === true;
      this.music = music === true;
      this.volume = boundedVolume(volume);
      this._active = false;
      this._unlocked = false;
      this._disposed = false;
      this._context = null;
      this._master = null;
      this._musicGain = null;
      this._musicTimer = null;
      this._musicStep = 0;
      this._voices = new Set();
      this._unlocking = null;
      this._visibility = () => {
        if (!this._visible()) this._stopVoices();
        this._syncMusic();
      };
      global.document?.addEventListener('visibilitychange', this._visibility);
    }
    _visible() { return global.document?.hidden !== true; }
    _ready() {
      return !this._disposed && this._unlocked && this._active && this._visible() && this._context && this._context.state !== 'closed' && this._context.state !== 'suspended' && this._context.state !== 'interrupted';
    }
    _createContext() {
      if (this._context && this._context.state !== 'closed') return true;
      const Context = global.AudioContext || global.webkitAudioContext;
      if (!Context) return false;
      try {
        this._context = new Context();
        this._master = this._context.createGain();
        this._master.gain.value = this.volume;
        this._master.connect(this._context.destination);
        this._musicGain = this._context.createGain();
        this._musicGain.gain.value = .55;
        this._musicGain.connect(this._master);
        return true;
      } catch (_) {
        this._discardContext();
        return false;
      }
    }
    async unlock() {
      if (this._disposed) return false;
      if (this._unlocking) return this._unlocking;
      this._unlocking = (async () => {
        try {
          if (!this._createContext()) return false;
          const context = this._context;
          if (context.state !== 'running' && typeof context.resume === 'function') await context.resume();
          if (this._disposed || context !== this._context || context.state === 'closed') return false;
          this._unlocked = context.state === 'running' || typeof context.state !== 'string';
          this._syncMusic();
          return this._unlocked;
        } catch (_) {
          this._unlocked = false;
          this._stopMusic();
          return false;
        }
      })();
      try { return await this._unlocking; }
      finally { this._unlocking = null; }
    }
    configure(options = {}) {
      if (this._disposed || !options || typeof options !== 'object') return;
      if (typeof options.sfx === 'boolean') this.sfx = options.sfx;
      if (typeof options.music === 'boolean') this.music = options.music;
      if (Object.prototype.hasOwnProperty.call(options, 'volume')) this.volume = boundedVolume(options.volume, this.volume);
      if (this._master) {
        try { this._master.gain.value = this.volume; } catch (_) {}
      }
      if (!this.sfx) this._stopVoices('sfx');
      this._syncMusic();
    }
    setActive(active) {
      if (this._disposed) return;
      this._active = active === true;
      if (!this._active) this._stopVoices();
      this._syncMusic();
    }
    _cleanVoice(voice) {
      if (voice.done) return;
      voice.done = true;
      this._voices.delete(voice);
      try { voice.oscillator.disconnect(); } catch (_) {}
      try { voice.gain.disconnect(); } catch (_) {}
    }
    _stopVoice(voice) {
      try { voice.oscillator.stop(); } catch (_) {}
      this._cleanVoice(voice);
    }
    _stopVoices(kind = null) {
      for (const voice of [...this._voices]) if (!kind || voice.kind === kind) this._stopVoice(voice);
    }
    _tone(frequency, {kind = 'sfx', delay = 0, duration = .2, gain = .08, type = 'sine'} = {}) {
      if (!this._ready() || !Number.isFinite(frequency) || frequency <= 0) return;
      if ((kind === 'sfx' && !this.sfx) || (kind === 'music' && !this.music)) return;
      let oscillator, envelope, voice;
      try {
        // Fast taps cannot leave an unbounded number of live oscillators.
        while (this._voices.size >= 24) this._stopVoice(this._voices.values().next().value);
        const context = this._context, time = context.currentTime + Math.max(0, delay);
        oscillator = context.createOscillator();
        envelope = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, time);
        const attack = kind === 'music' ? .12 : .012;
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(gain, time + attack);
        envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
        oscillator.connect(envelope);
        envelope.connect(kind === 'music' ? this._musicGain : this._master);
        voice = {oscillator, gain: envelope, kind, done: false};
        this._voices.add(voice);
        oscillator.onended = () => this._cleanVoice(voice);
        oscillator.start(time);
        oscillator.stop(time + duration + .025);
      } catch (_) {
        if (voice) this._stopVoice(voice);
        else {
          try { oscillator?.stop(); oscillator?.disconnect(); } catch (_) {}
          try { envelope?.disconnect(); } catch (_) {}
        }
      }
    }
    move(valueOrWave = 1) {
      if (!this.sfx) return;
      const value = Number.isFinite(valueOrWave) ? Math.max(1, Math.min(8, valueOrWave)) : 1;
      this._tone(320 + value * 42, {duration: .17, gain: .08});
      this._tone((320 + value * 42) * 1.5, {delay: .035, duration: .15, gain: .026});
    }
    click() { this._tone(420, {duration: .075, gain: .045}); }
    victory() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => this._tone(frequency, {delay: index * .09, duration: .28, gain: .065}));
    }
    _syncMusic() {
      if (!this.music || !this._ready()) { this._stopMusic(); return; }
      if (this._musicTimer !== null) return;
      this._musicTick();
    }
    _musicTick() {
      this._musicTimer = null;
      if (!this.music || !this._ready()) { this._stopMusic(); return; }
      // A quiet eight-step garden motif, generated locally rather than sampled.
      const roots = [220, 261.63, 246.94, 293.66, 196, 246.94, 261.63, 220];
      const frequency = roots[this._musicStep++ % roots.length];
      this._tone(frequency, {kind: 'music', duration: 2.1, gain: .06});
      this._tone(frequency * 1.5, {kind: 'music', delay: .18, duration: 1.8, gain: .033});
      this._musicTimer = global.setTimeout(() => this._musicTick(), 1600);
    }
    _stopMusic() {
      if (this._musicTimer !== null) global.clearTimeout(this._musicTimer);
      this._musicTimer = null;
      this._stopVoices('music');
    }
    stop() {
      this._active = false;
      this._stopMusic();
      this._stopVoices();
    }
    _discardContext() {
      this._stopMusic();
      this._stopVoices();
      const context = this._context;
      this._context = this._master = this._musicGain = null;
      this._unlocked = false;
      try {
        const closing = context?.close?.();
        if (closing && typeof closing.catch === 'function') closing.catch(() => {});
      } catch (_) {}
    }
    dispose() {
      if (this._disposed) return;
      this._disposed = true;
      this._active = false;
      global.document?.removeEventListener('visibilitychange', this._visibility);
      this._discardContext();
    }
  }
  global.HexAudio = HexAudio;
})(typeof window !== 'undefined' ? window : globalThis);
