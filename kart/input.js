// Keyboard + per-button Pointer Events (multi-touch safe: each button tracks its own pointers).
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
  Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift', KeyE: 'item', Enter: 'item',
};

export function createInput(buttons) {
  const keys = new Set();
  const held = { left: new Set(), right: new Set(), drift: new Set(), brake: new Set() };
  let itemQueued = false;
  let touch = matchMedia('(pointer: coarse)').matches;
  let enabled = false;

  addEventListener('keydown', (e) => {
    const ctl = KEYS[e.code];
    if (!ctl || !enabled) return;
    e.preventDefault();
    touch = false;
    if (ctl === 'item' && !e.repeat) itemQueued = true;
    keys.add(ctl);
  });
  addEventListener('keyup', (e) => { if (KEYS[e.code]) keys.delete(KEYS[e.code]); });
  addEventListener('blur', () => keys.clear());

  for (const btn of buttons) {
    const ctl = btn.dataset.ctl;
    const release = (e) => { held[ctl]?.delete(e.pointerId); btn.classList.toggle('on', held[ctl]?.size > 0); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType !== 'mouse') touch = true;
      if (ctl === 'item') { itemQueued = true; return; }
      held[ctl].add(e.pointerId);
      btn.classList.add('on');
      try { btn.setPointerCapture(e.pointerId); } catch { /* pointer already gone: pointerup still releases */ }
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const on = (ctl) => keys.has(ctl) || (held[ctl]?.size ?? 0) > 0;

  return {
    read() {
      const brake = on('brake');
      return {
        steer: (on('right') ? 1 : 0) - (on('left') ? 1 : 0),
        gas: touch ? !brake : keys.has('gas'), // touch: automatic gas
        brake,
        drift: on('drift'),
      };
    },
    takeItem() { const q = itemQueued; itemQueued = false; return q; },
    isTouch: () => touch,
    setEnabled(v) {
      enabled = v;
      if (!v) { keys.clear(); for (const s of Object.values(held)) s.clear(); itemQueued = false; }
    },
  };
}
