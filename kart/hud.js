// DOM side: race HUD, countdown, banners, racer picker and results table.
import { ITEM_ICON, formatTime } from './logic.js';

const $ = (id) => document.getElementById(id);
const STAT_LABELS = [['speed', 'Kecepatan'], ['accel', 'Akselerasi'], ['turn', 'Belok']];
const STAT_MAX = 5;

export function createHud() {
  const el = {
    lap: $('lap'), time: $('time'), pos: $('pos'), item: $('item'), speed: $('speedFill'),
    banner: $('banner'), wrong: $('wrongWay'), count: $('countdown'), hud: $('hud'),
  };
  const last = {};
  const set = (key, node, text) => { if (last[key] !== text) { last[key] = text; node.textContent = text; } };
  let bannerTimer = 0;

  return {
    race({ lap, laps, pos, total, time, item, speed01, wrongWay }) {
      set('lap', el.lap, `${lap}/${laps}`);
      set('pos', el.pos, `${pos}/${total}`);
      set('time', el.time, formatTime(time));
      set('item', el.item, item ? ITEM_ICON[item] : '');
      el.speed.style.transform = `scaleX(${Math.max(0, Math.min(1, speed01)).toFixed(3)})`;
      el.wrong.hidden = !wrongWay;
    },
    countdown(text) {
      el.count.hidden = !text;
      if (text) { el.count.textContent = text; el.count.classList.remove('pop'); void el.count.offsetWidth; el.count.classList.add('pop'); }
    },
    banner(text, sec = 2) {
      el.banner.textContent = text;
      el.banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { el.banner.hidden = true; }, sec * 1000);
    },
    showRace(on) { el.hud.hidden = !on; document.body.classList.toggle('racing', on); if (!on) { el.banner.hidden = true; el.wrong.hidden = true; } },
  };
}

export function renderPicker(list, chars, selectedId, onPick) {
  list.replaceChildren(...chars.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'racer' + (c.id === selectedId ? ' sel' : '');
    b.setAttribute('aria-pressed', String(c.id === selectedId));
    b.style.setProperty('--kc', '#' + c.color.toString(16).padStart(6, '0'));
    b.innerHTML = `<span class="face" aria-hidden="true">${c.emoji}</span><b>${c.name}</b>` +
      STAT_LABELS.map(([k, label]) => `<span class="stat"><small>${label}</small><i style="--v:${c.stats[k] / STAT_MAX}"></i></span>`).join('');
    b.addEventListener('click', () => onPick(c.id));
    return b;
  }));
}

// rows: [{ name, emoji, isPlayer, time|null }] already in finishing order
export function renderResults(table, rows) {
  table.replaceChildren(...rows.map((r, i) => {
    const tr = document.createElement('tr');
    if (r.isPlayer) tr.className = 'me';
    tr.innerHTML = `<td>${i + 1}</td><td>${r.emoji} ${r.name}${r.isPlayer ? ' (kamu)' : ''}</td><td>${r.time != null ? formatTime(r.time) : '—'}</td>`;
    return tr;
  }));
}
