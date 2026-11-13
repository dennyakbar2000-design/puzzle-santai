// Shared helpers for every page. Storage can be blocked (private mode), so every access is guarded.
export function getBest(key) {
  try {
    return Number(localStorage.getItem('best:' + key)) || 0;
  } catch {
    return 0;
  }
}

// Saves only if higher; returns the best score after saving.
export function saveBest(key, score) {
  const best = getBest(key);
  if (score <= best) return best;
  try {
    localStorage.setItem('best:' + key, String(score));
  } catch {
    // storage unavailable: keep best for this page view only
  }
  return score;
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(() => {
    // offline mode simply stays off; the game still works online
  });
}
