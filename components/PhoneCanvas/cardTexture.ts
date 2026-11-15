import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { PHONE_ROTATION_Y } from './sceneConstants';
import { seededRandom } from './noise';

export type ImageInfo = { width: number; height: number; flipY: boolean };

export type CardFrame = {
  /** Canvas matrix [a, b, c, d] that takes text space (1 unit = 1 mm on the card) to texture pixels. */
  matrix: [number, number, number, number];
  /** Radius of the card in millimetres. */
  radiusMm: number;
  /** Where the card sits in the texture, in pixels. */
  box: { x0: number; y0: number; x1: number; y1: number };
};

type Plane = { right: THREE.Vector3; down: THREE.Vector3 };

/** Reading axes on the dial face: up is towards the back of the phone. */
function readingPlane(normal: THREE.Vector3, phoneRotationY: number): Plane {
  const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    phoneRotationY,
  );
  const up = back.sub(normal.clone().multiplyScalar(back.dot(normal))).normalize();
  return { right: new THREE.Vector3().crossVectors(up, normal).normalize(), down: up.negate() };
}

/**
 * Works out how to draw text on the card so it reads upright on the dial.
 *
 * The card shares a texture atlas with the rest of the phone, so its UV layout
 * could be rotated or mirrored. Instead of guessing a flip, fit how the UV
 * coordinates map onto the card in the world, and build the text transform from that.
 */
export function computeCardFrame(
  card: THREE.Mesh,
  dial: DialGeometry,
  phoneRotationY: number,
  image: ImageInfo,
): CardFrame {
  card.updateWorldMatrix(true, false);
  const uv = card.geometry.getAttribute('uv');
  const position = card.geometry.getAttribute('position');
  const count = position.count;

  const points: THREE.Vector3[] = [];
  const meanPoint = new THREE.Vector3();
  let meanU = 0;
  let meanV = 0;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(card.matrixWorld);
    points.push(p);
    meanPoint.add(p);
    const u = uv.getX(i);
    const v = uv.getY(i);
    meanU += u;
    meanV += v;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  meanPoint.divideScalar(count);
  meanU /= count;
  meanV /= count;

  // Least squares: world position = origin + gu * u + gv * v.
  let suu = 0;
  let suv = 0;
  let svv = 0;
  const cu = new THREE.Vector3();
  const cv = new THREE.Vector3();
  points.forEach((p, i) => {
    const du = uv.getX(i) - meanU;
    const dv = uv.getY(i) - meanV;
    const dp = p.clone().sub(meanPoint);
    suu += du * du;
    suv += du * dv;
    svv += dv * dv;
    cu.addScaledVector(dp, du);
    cv.addScaledVector(dp, dv);
  });
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-18)
    throw new Error('The card UVs are degenerate, so its orientation cannot be found.');
  const gu = cu.clone().multiplyScalar(svv).addScaledVector(cv, -suv).divideScalar(det);
  const gv = cv.clone().multiplyScalar(suu).addScaledVector(cu, -suv).divideScalar(det);

  // Canvas pixels to world metres, measured along the reading axes.
  const { right, down } = readingPlane(dial.normal, phoneRotationY);
  const sy = image.flipY ? -1 : 1;
  const a11 = gu.dot(right) / image.width;
  const a12 = (gv.dot(right) * sy) / image.height;
  const a21 = gu.dot(down) / image.width;
  const a22 = (gv.dot(down) * sy) / image.height;
  const aDet = a11 * a22 - a12 * a21;

  // Inverse maps metres to pixels. Text space is millimetres, so scale by 0.001.
  const k = 0.001 / aDet;
  const matrix: CardFrame['matrix'] = [a22 * k, -a21 * k, -a12 * k, a11 * k];

  let radius = 0;
  for (const p of points) {
    const d = p.clone().sub(meanPoint);
    d.addScaledVector(dial.normal, -d.dot(dial.normal));
    radius = Math.max(radius, d.length());
  }

  const pixelY = (v: number) => (image.flipY ? 1 - v : v) * image.height;
  const y0 = Math.min(pixelY(minV), pixelY(maxV));
  const y1 = Math.max(pixelY(minV), pixelY(maxV));
  return {
    matrix,
    radiusMm: radius * 1000,
    box: { x0: minU * image.width, y0, x1: maxU * image.width, y1 },
  };
}

/**
 * Paints aged paper over the card's patch of the atlas and writes the number on it.
 * Needs a browser canvas.
 */
export function paintCardTexture(base: THREE.Texture, frame: CardFrame): THREE.CanvasTexture {
  const source = base.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('A 2D canvas is needed to paint the dial card.');
  g.drawImage(source, 0, 0);

  const { x0, y0, x1, y1 } = frame.box;
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const random = seededRandom(23);

  const paper = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
  paper.addColorStop(0, '#e9dcb8');
  paper.addColorStop(0.75, '#cdb98a');
  paper.addColorStop(1, '#8f7a4c');
  g.fillStyle = paper;
  g.fillRect(x0, y0, w, h);

  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(110,70,30,${0.05 + random() * 0.15})`;
    g.beginPath();
    g.arc(x0 + random() * w, y0 + random() * h, random() * w * 0.03, 0, Math.PI * 2);
    g.fill();
  }

  // Text space is millimetres on the card, laid out by the frame so it reads upright.
  const r = frame.radiusMm;
  g.save();
  g.translate(cx, cy);
  g.transform(...frame.matrix, 0, 0);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#2b2a5e';
  g.font = `italic ${r * 0.68}px "Brush Script MT", "Segoe Script", cursive`;
  g.fillText('1023', 0, r * 0.04);
  g.fillStyle = '#5a1a12';
  g.font = `${r * 0.22}px "Courier New", monospace`;
  g.fillText('DIRECTORY', 0, -r * 0.6);
  g.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = base.colorSpace;
  texture.flipY = base.flipY;
  texture.channel = base.channel;
  texture.anisotropy = 8;
  return texture;
}

/** Gives the card its own material and the handwritten texture. Browser only. */
export function applyCardTexture(card: THREE.Mesh, dial: DialGeometry): void {
  // React can run effects twice in development. Paint the card only once.
  if (card.userData['cardPainted']) return;
  const material = card.material;
  if (Array.isArray(material) || !(material instanceof THREE.MeshStandardMaterial) || !material.map)
    return;
  const base = material.map;
  const image = base.image as { width: number; height: number };
  const frame = computeCardFrame(card, dial, PHONE_ROTATION_Y, {
    width: image.width,
    height: image.height,
    flipY: base.flipY,
  });
  const own = material.clone();
  own.map = paintCardTexture(base, frame);
  own.needsUpdate = true;
  card.material = own;
  card.userData['cardPainted'] = true;
}
