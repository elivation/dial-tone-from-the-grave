import * as THREE from 'three';
import { HOLE_ANGLES, travelDegrees, type Digit } from '@/lib/dial';
import { TrailLedger, toCanvas, type DecalSpace, type DialPoint, type Stroke } from './gooDecals';
import { edgeNoise } from './gooShapes';
import { seededRandom } from './noise';
import type { PreparedPhone } from './preparePhone';
import { GOO } from './sceneConstants';

/** Makes a square canvas. The browser's by default; tests pass a fake. */
export type CanvasFactory = (size: number) => HTMLCanvasElement;

export type GooPainter = {
  /** A finger has put `digit`'s hole into motion. */
  beginDrag: (digit: Digit) => void;
  /** The wheel has turned to `turn` degrees while the finger drags it. */
  dragTo: (turn: number) => void;
  /** The finger has let go. Sends whatever is still waiting to the GPU. */
  endDrag: () => void;
  /** Puts the plate's shared material back and frees the textures. */
  dispose: () => void;
};

/** Live trails are sent to the GPU at most this often while dragging. */
const UPLOAD_MS = 50;
/** How raised painted goo looks to the light, in metres at full height. */
const BUMP = { film: 0.00025, plate: 0.0002 };

const fresh = new THREE.Color(GOO.thickColour);
const thin = new THREE.Color(GOO.thinColour);
const crust = new THREE.Color(GOO.crustColour);

/** Goo colour for how wet it is: 1 bright and fresh, 0 dried. Dried goo stays green, only darker. */
function gooCss(wet: number, lift = 0): string {
  const dry = 1 - wet;
  const c = fresh
    .clone()
    .lerp(thin, Math.max(0, dry * 0.55 - lift))
    .lerp(crust, dry * 0.35);
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

/** Surface data for the shader: red is height, green roughness, blue wetness. */
function surfaceCss(height: number, wet: number): string {
  const rough = 0.08 + 0.75 * (1 - wet);
  return `rgb(${Math.round(height * 255)},${Math.round(rough * 255)},${Math.round(wet * 255)})`;
}

type Layer = {
  space: DecalSpace;
  paint: CanvasRenderingContext2D;
  surface: CanvasRenderingContext2D;
  paintTexture: THREE.CanvasTexture;
  surfaceTexture: THREE.CanvasTexture;
  /** Painted goo stays off the card, out to this radius in metres. */
  cardClear: number;
  dirty: boolean;
};

function makeLayer(createCanvas: CanvasFactory, space: DecalSpace, cardClear: number): Layer {
  const paintCanvas = createCanvas(space.size);
  const surfaceCanvas = createCanvas(space.size);
  const paint = paintCanvas.getContext('2d') as CanvasRenderingContext2D;
  const surface = surfaceCanvas.getContext('2d') as CanvasRenderingContext2D;
  const paintTexture = new THREE.CanvasTexture(paintCanvas);
  paintTexture.colorSpace = THREE.SRGBColorSpace;
  paintTexture.anisotropy = 4;
  const surfaceTexture = new THREE.CanvasTexture(surfaceCanvas);
  surfaceTexture.anisotropy = 4;
  return { space, paint, surface, paintTexture, surfaceTexture, cardClear, dirty: false };
}

/** Pixels per metre on a layer's canvas. */
const scaleOf = (space: DecalSpace) => space.size / (2 * space.extent);

/** Traces a noisy closed outline: never a circle, never an ellipse. */
function outline(
  ctx: CanvasRenderingContext2D,
  centre: { x: number; y: number },
  rx: number,
  ry: number,
  angle: number,
  seed: number,
) {
  ctx.beginPath();
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wobble = 0.7 + 0.6 * edgeNoise(t, seed, 2.4);
    const x = Math.cos(t) * rx * wobble;
    const y = Math.sin(t) * ry * wobble;
    // Canvas y runs down, dial angles run clockwise from 12 o'clock: x is up the canvas, y across.
    const px = centre.x + x * Math.sin(angle) + y * Math.cos(angle);
    const py = centre.y - x * Math.cos(angle) + y * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBlob(
  layer: Layer,
  at: DialPoint,
  size: number,
  stretch: number,
  angle: number,
  alpha: number,
  wet: number,
  seed: number,
  lift = 0,
) {
  const { paint, surface, space } = layer;
  const c = toCanvas(at, space);
  const r = size * scaleOf(space);
  // The body of it, then a thicker, wetter middle, then a dried rim.
  outline(paint, c, r * stretch, r, angle, seed);
  paint.globalAlpha = alpha;
  paint.fillStyle = gooCss(wet, lift);
  paint.fill();
  outline(surface, c, r * stretch, r, angle, seed);
  surface.globalAlpha = 1;
  surface.fillStyle = surfaceCss(0.45, wet);
  surface.fill();
  paint.globalAlpha = alpha * 0.9;
  paint.lineWidth = Math.max(1, r * 0.16);
  paint.strokeStyle = gooCss(0);
  outline(paint, c, r * stretch, r, angle, seed);
  paint.stroke();
  surface.lineWidth = Math.max(1, r * 0.16);
  surface.strokeStyle = surfaceCss(0.3, 0);
  outline(surface, c, r * stretch, r, angle, seed);
  surface.stroke();
  if (wet > 0.4) {
    outline(paint, c, r * stretch * 0.55, r * 0.55, angle, seed + 7);
    paint.globalAlpha = alpha * 0.6;
    paint.fillStyle = gooCss(wet, 0.15);
    paint.fill();
    outline(surface, c, r * stretch * 0.55, r * 0.55, angle, seed + 7);
    surface.fillStyle = surfaceCss(0.9, wet);
    surface.fill();
  }
  paint.globalAlpha = 1;
}

function drawStreak(layer: Layer, stroke: Extract<Stroke, { kind: 'streak' }>) {
  const { paint, surface, space } = layer;
  const scale = scaleOf(space);
  const n = stroke.points.length;
  const chunks = 4;
  const per = Math.ceil((n - 1) / chunks);
  // Drawn as a few continuous runs, each thinner and fainter than the one before, so the streak
  // drags out to nothing without the beads that short separate strokes leave.
  for (let c = 0; c < chunks; c++) {
    const from = c * per;
    const to = Math.min(n - 1, from + per);
    if (to <= from) break;
    const t = (from + to) / 2 / (n - 1);
    const width = Math.max(0.8, stroke.width * scale * (1 - 0.6 * t));
    const trace = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const wobble =
          (edgeNoise((i / (n - 1)) * 4, stroke.seed, 1.2) - 0.5) * stroke.width * 1.5 * scale;
        const p = toCanvas(stroke.points[i] as DialPoint, space);
        if (i === from) ctx.moveTo(p.x + wobble, p.y);
        else ctx.lineTo(p.x + wobble, p.y);
      }
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    trace(paint);
    paint.globalAlpha = stroke.alpha * (1 - 0.7 * t);
    paint.strokeStyle = gooCss(stroke.wet);
    paint.stroke();
    trace(surface);
    surface.globalAlpha = 1;
    surface.strokeStyle = surfaceCss(0.25 * (1 - t), stroke.wet);
    surface.stroke();
  }
  paint.globalAlpha = 1;
}

/** A smudged fingerprint: whorls of fine ridges in dried goo, dragged a little to one side. */
function drawPrint(layer: Layer, stroke: Extract<Stroke, { kind: 'print' }>) {
  const { paint, surface, space } = layer;
  const scale = scaleOf(space);
  const c = toCanvas(stroke.at, space);
  const rx = stroke.size * 0.78 * scale;
  const ry = stroke.size * scale;
  const random = seededRandom(stroke.seed);
  const ridges = 13;
  const drag = {
    x: Math.cos(stroke.angle) * 0.0007 * scale,
    y: Math.sin(stroke.angle) * 0.0007 * scale,
  };
  // A faint film of goo the pad left, under the ridges.
  outline(paint, c, rx, ry, stroke.angle, stroke.seed);
  paint.globalAlpha = stroke.alpha * 0.6;
  paint.fillStyle = gooCss(0.7);
  paint.fill();
  outline(surface, c, rx, ry, stroke.angle, stroke.seed);
  surface.globalAlpha = 1;
  // Still tacky, so the candle catches it.
  surface.fillStyle = surfaceCss(0.25, 0.75);
  surface.fill();
  for (const [pass, strength] of [
    [0, 1],
    [1, 0.4],
  ] as const) {
    const shift = { x: c.x + drag.x * pass, y: c.y + drag.y * pass };
    for (let k = 1; k <= ridges; k++) {
      const f = k / ridges;
      // The whorl's centre sits off-centre, low on the pad, as on a real fingertip.
      const offset = (1 - f) * 0.25;
      const centre = { x: shift.x + rx * offset * 0.3, y: shift.y + ry * offset };
      paint.globalAlpha = stroke.alpha * strength * (0.5 + 0.5 * random()) * (1 - 0.35 * f);
      paint.strokeStyle = gooCss(0.85, 0.1);
      paint.lineWidth = Math.max(1, 0.00026 * scale);
      outline(paint, centre, rx * f, ry * f, stroke.angle, stroke.seed + k);
      paint.stroke();
      if (pass === 0) {
        surface.globalAlpha = 1;
        surface.strokeStyle = surfaceCss(0.55, 0.85);
        surface.lineWidth = Math.max(0.8, 0.00016 * scale);
        outline(surface, centre, rx * f, ry * f, stroke.angle, stroke.seed + k);
        surface.stroke();
      }
    }
  }
  paint.globalAlpha = 1;
}

function drawStroke(layer: Layer, stroke: Stroke) {
  switch (stroke.kind) {
    case 'smear':
      drawBlob(
        layer,
        stroke.at,
        stroke.size,
        stroke.stretch,
        stroke.angle,
        stroke.alpha,
        stroke.wet,
        stroke.seed,
      );
      return;
    case 'dab':
      drawBlob(
        layer,
        stroke.at,
        stroke.size,
        1.25,
        (stroke.seed % 628) / 100,
        stroke.alpha,
        stroke.wet,
        stroke.seed,
        // Trails are seen through the glass wheel, so they need to be a shade brighter to read.
        0.15,
      );
      return;
    case 'streak':
      drawStreak(layer, stroke);
      return;
    case 'print':
      drawPrint(layer, stroke);
  }
}

/** Wipes the card's circle clean on a layer, so no painted goo can ever reach the 1023 card. */
function clearCard(layer: Layer) {
  const c = toCanvas({ x: 0, y: 0 }, layer.space);
  const r = layer.cardClear * scaleOf(layer.space);
  for (const ctx of [layer.paint, layer.surface]) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function upload(layer: Layer) {
  clearCard(layer);
  layer.paintTexture.needsUpdate = true;
  layer.surfaceTexture.needsUpdate = true;
  layer.dirty = false;
}

/** Tilts the normal by the slope of the painted height, so painted goo catches the light like a raised film. */
const bumpGlsl = (height: string) => `
{
  float gooH = ${height};
  vec3 gooDpdx = dFdx( -vViewPosition );
  vec3 gooDpdy = dFdy( -vViewPosition );
  vec3 gooR1 = cross( gooDpdy, normal );
  vec3 gooR2 = cross( normal, gooDpdx );
  float gooDet = dot( gooDpdx, gooR1 );
  vec3 gooGrad = sign( gooDet ) * ( dFdx( gooH ) * gooR1 + dFdy( gooH ) * gooR2 );
  normal = normalize( abs( gooDet ) * normal - gooGrad );
}`;

/**
 * The film over the wheel's top face. Colour and coverage come from the paint canvas, through the
 * colour map. Height, roughness and wetness come from the surface canvas, through the roughness map.
 */
function filmMaterial(layer: Layer): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    map: layer.paintTexture,
    roughnessMap: layer.surfaceTexture,
    roughness: 1,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    emissive: 0xffffff,
    emissiveMap: layer.paintTexture,
    // As bright as the pools, or a dark film on the black glass cannot be seen at all.
    emissiveIntensity: GOO.emissiveIntensity * 1.4,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n${bumpGlsl(`texture2D( roughnessMap, vRoughnessMapUv ).r * diffuseColor.a * ${BUMP.film.toFixed(6)}`)}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.35 + 0.65 * texture2D( roughnessMap, vRoughnessMapUv ).b;',
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= texture2D( roughnessMap, vRoughnessMapUv ).b;\n#endif',
      );
  };
  material.customProgramCacheKey = () => 'goo-film';
  return material;
}

/**
 * The plate's own material, with painted goo laid over it through `gooUv`. The plate is opaque, so
 * unlike a see-through decal it still shows through the glass wheel. Keeps whatever patch the
 * shared material already had, such as the dust.
 */
function plateMaterial(
  shared: THREE.MeshPhysicalMaterial,
  layer: Layer,
): THREE.MeshPhysicalMaterial {
  const material = shared.clone();
  material.clearcoat = 1;
  material.clearcoatRoughness = 0.06;
  const previous = shared.onBeforeCompile.bind(shared);
  const previousKey = shared.customProgramCacheKey.bind(shared);
  const uniforms = {
    gooPaint: { value: layer.paintTexture },
    gooSurface: { value: layer.surfaceTexture },
  };
  material.userData['gooUniforms'] = uniforms;
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec2 gooUv;\nvarying vec2 vGooUv;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGooUv = gooUv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D gooPaint;\nuniform sampler2D gooSurface;\nvarying vec2 vGooUv;',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
vec4 gooP = texture2D( gooPaint, vGooUv );
vec4 gooS = texture2D( gooSurface, vGooUv );
diffuseColor.rgb = mix( diffuseColor.rgb, gooP.rgb, gooP.a );
roughnessFactor = mix( roughnessFactor, gooS.g, gooP.a );`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n${bumpGlsl(`gooS.r * gooP.a * ${BUMP.plate.toFixed(6)}`)}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += gooP.rgb * gooP.a * ( 0.35 + 0.65 * gooS.b ) * ${(GOO.emissiveIntensity * 1.4).toFixed(3)};`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= gooP.a * gooS.b;\n#endif',
      );
  };
  material.customProgramCacheKey = () => `${previousKey()}|goo-plate`;
  material.needsUpdate = true;
  return material;
}

const defaultCanvas: CanvasFactory = (size) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

/** The hole a digit is dialled from: the opening nearest that digit's angle. */
function holeFor(phone: PreparedPhone, digit: Digit): number {
  const gap = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  let best = 0;
  phone.decals.openings.forEach((o, i) => {
    const current = phone.decals.openings[best];
    if (current && gap(o.degrees, HOLE_ANGLES[digit]) < gap(current.degrees, HOLE_ANGLES[digit]))
      best = i;
  });
  return best;
}

/**
 * Paints the goo that is drawn rather than built: the overflow and finger streaks on the wheel
 * face, fingerprints on the plate, and the trails a dragged hole leaves on the plate. The trails
 * build up over the session and reset when the page reloads. Canvases are 1024 pixels, and are
 * only sent to the GPU while a hole is being dragged, at most every 50 ms, then once on letting go.
 */
export function createGooPainter(
  phone: PreparedPhone,
  {
    createCanvas = defaultCanvas,
    now = () => performance.now(),
  }: { createCanvas?: CanvasFactory; now?: () => number } = {},
): GooPainter {
  const { decals } = phone;
  const cardClear = decals.cardRadius + 0.0005;
  const wheel = makeLayer(createCanvas, decals.wheelSpace, cardClear);
  const plate = makeLayer(createCanvas, decals.plateSpace, cardClear);
  for (const stroke of decals.film.strokes) drawStroke(wheel, stroke);
  for (const stroke of decals.prints) drawStroke(plate, stroke);
  clearCard(wheel);
  clearCard(plate);

  const film = decals.wheelFilm;
  const placeholder = film.material;
  film.material = filmMaterial(wheel);
  film.visible = true;

  const plateMesh = phone.plate;
  const sharedPlate = plateMesh?.material;
  if (plateMesh && sharedPlate instanceof THREE.MeshPhysicalMaterial) {
    plateMesh.material = plateMaterial(sharedPlate, plate);
  }

  const ledger = new TrailLedger({ openings: decals.openings });
  let hole: number | null = null;
  let digit: Digit | null = null;
  let lastTurn = 0;
  // Where fingers wipe goo off the stop: at the stop's angle, out past the wheel's edge where it shows.
  const stopAt = (() => {
    const d = decals.stopEdge.clone().sub(phone.dial.centre);
    const a = Math.atan2(d.dot(phone.dial.rAx), d.dot(phone.dial.uAx));
    const r = phone.dial.radius * 1.08;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  })();
  let lastUpload = -Infinity;

  const flush = (force: boolean) => {
    if (!wheel.dirty && !plate.dirty) return;
    if (!force && now() - lastUpload < UPLOAD_MS) return;
    if (wheel.dirty) upload(wheel);
    if (plate.dirty) upload(plate);
    lastUpload = now();
  };

  return {
    beginDrag: (dialled) => {
      digit = dialled;
      hole = holeFor(phone, dialled);
      lastTurn = 0;
      const smear = ledger.behind(hole);
      for (const dab of smear) drawStroke(wheel, dab);
      if (smear.length) wheel.dirty = true;
    },
    dragTo: (turn) => {
      if (hole === null) return;
      const dabs = ledger.sweep(hole, lastTurn, turn);
      lastTurn = turn;
      for (const dab of dabs) drawStroke(plate, dab);
      if (dabs.length) plate.dirty = true;
      flush(false);
    },
    endDrag: () => {
      if (hole === null) return;
      // A finger that went all the way to the stop leaves some of its goo on it.
      if (digit && lastTurn >= travelDegrees(digit) - 3) {
        const dabs = ledger.atStop(stopAt);
        for (const dab of dabs) drawStroke(plate, dab);
        if (dabs.length) plate.dirty = true;
      }
      hole = null;
      digit = null;
      flush(true);
    },
    dispose: () => {
      for (const layer of [wheel, plate]) {
        layer.paintTexture.dispose();
        layer.surfaceTexture.dispose();
      }
      (film.material as THREE.Material).dispose();
      film.material = placeholder;
      film.visible = false;
      if (plateMesh && sharedPlate) {
        (plateMesh.material as THREE.Material).dispose();
        plateMesh.material = sharedPlate;
      }
    },
  };
}
