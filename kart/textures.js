// Tiny canvas-drawn textures (no image files), nearest-filtered for the chunky retro look.
import * as THREE from '../vendor/three.module.min.js';

export function makeCanvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function questionTexture() {
  return makeCanvasTexture(32, 32, (g) => {
    g.fillStyle = 'rgba(120,200,255,0.55)';
    g.fillRect(0, 0, 32, 32);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 29, 29);
    g.fillStyle = '#ffffff';
    g.font = 'bold 24px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 16, 17);
  });
}
