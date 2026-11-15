import * as THREE from 'three';
import { fbm } from './noise';

function makeCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('A 2D canvas is needed to paint the scene textures.');
  return { canvas, g };
}

/**
 * Roughness for the desk: dark stains and a water ring where a cup stood.
 * Small on purpose, so the first frame is not held up by painting pixels.
 */
export function deskRoughnessTexture(size = 256): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(size, size);
  const image = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const grain = fbm(nx * 8, ny * 8, 3);
      const stain = fbm(nx * 4 + 10, ny * 4 + 3, 4);
      const dark = stain > 0.62 ? (stain - 0.62) * 2.2 : 0;
      const ringDistance = Math.hypot(nx - 0.28, ny - 0.7);
      const water = Math.exp(-Math.pow((ringDistance - 0.09) * 90, 2)) * 0.5;
      const rough = Math.max(40, Math.min(255, 140 + grain * 60 - water * 120 + dark * 40));
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = rough;
      image.data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.2, 1.2);
  return texture;
}

/** A soft dark blot that grounds the phone on the desk. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(256, 256);
  const gradient = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export function flameTexture(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(64, 160);
  const gradient = g.createRadialGradient(32, 110, 2, 32, 95, 60);
  gradient.addColorStop(0, 'rgba(255,255,235,1)');
  gradient.addColorStop(0.25, 'rgba(255,220,140,0.95)');
  gradient.addColorStop(0.55, 'rgba(255,140,40,0.55)');
  gradient.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = gradient;
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(52, 60, 58, 120, 32, 152);
  g.bezierCurveTo(6, 120, 12, 60, 32, 4);
  g.fill();
  g.fillStyle = 'rgba(40,60,160,0.5)';
  g.beginPath();
  g.ellipse(32, 140, 6, 9, 0, 0, Math.PI * 2);
  g.fill();
  return new THREE.CanvasTexture(canvas);
}

export function haloTexture(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(128, 128);
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,200,120,0.9)');
  gradient.addColorStop(0.3, 'rgba(255,150,60,0.35)');
  gradient.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
