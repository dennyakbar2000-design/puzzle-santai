// Synthesized sounds only (no audio files). Starts on the first user gesture.
const ENGINE_VOL = 0.045;

export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineGain = null;
  let muted = false;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
  }

  function setEngine(speed01, running) {
    if (!ctx) return;
    const now = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(55 + Math.max(0, speed01) * 120, now, 0.05);
    engineGain.gain.setTargetAtTime(running && !muted ? ENGINE_VOL : 0, now, 0.08);
  }

  function beep(freq, dur = 0.12, type = 'square', vol = 0.08, slideTo = null) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  return {
    unlock,
    setEngine,
    countdown: (go) => beep(go ? 880 : 440, go ? 0.4 : 0.18),
    pickup: () => beep(660, 0.15, 'triangle', 0.1, 1320),
    boost: () => beep(220, 0.35, 'sawtooth', 0.06, 660),
    hit: () => beep(300, 0.4, 'square', 0.08, 60),
    use: () => beep(500, 0.12, 'triangle', 0.08, 250),
    lap: () => beep(990, 0.25, 'triangle', 0.1),
    toggleMute() { muted = !muted; if (muted) setEngine(0, false); return muted; },
    isMuted: () => muted,
  };
}
