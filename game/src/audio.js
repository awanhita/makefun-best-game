// audio.js — tiny WebAudio synth for EMBERFALL sound effects.
// No audio files: every sound is synthesized with oscillators and filtered noise.
// The context is created lazily on the first user gesture; all calls are safe
// before that (headless runs and muted play simply stay silent).

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = AC ? new AC() : null;
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const t0 = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, freq), t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio must never break the game */ }
  }

  function noise(dur, vol, cutoff, delay) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const t0 = c.currentTime + (delay || 0);
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(cutoff, t0);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(c.destination);
      src.start(t0);
    } catch (e) { /* audio must never break the game */ }
  }

  return {
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone(740, 0.07, 'square', 0.045, 260);
    },
    enemyShoot() {
      tone(210, 0.12, 'sawtooth', 0.035, 110);
    },
    boom() {
      noise(0.35, 0.22, 900);
      tone(120, 0.3, 'sine', 0.18, 42);
    },
    bossBoom() {
      noise(0.6, 0.3, 600);
      tone(90, 0.55, 'sine', 0.25, 30);
    },
    hit() {
      tone(170, 0.25, 'sawtooth', 0.16, 55);
      noise(0.2, 0.14, 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.11, 990);
      tone(990, 0.13, 'sine', 0.09, 1320, 0.07);
    },
    bomb() {
      noise(0.7, 0.3, 1400);
      tone(70, 0.6, 'sine', 0.22, 28);
    },
    wave() {
      tone(440, 0.12, 'triangle', 0.11, 660);
      tone(660, 0.14, 'triangle', 0.1, 880, 0.1);
    },
    gameOver() {
      [330, 262, 196, 131].forEach((f, i) => tone(f, 0.34, 'triangle', 0.14, 0, i * 0.17));
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.26, 'triangle', 0.13, 0, i * 0.13));
    },
  };
}
