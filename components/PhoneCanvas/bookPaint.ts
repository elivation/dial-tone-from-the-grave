import {
  ADVERT,
  ADVERT_DIAL_NUMBER,
  ADVERT_LINES,
  NO_LISTINGS_LINES,
  PAGE_H,
  PAGE_W,
  cellOf,
  type BookLayout,
  type PageLayout,
  type PlacedEntry,
} from './bookContent';
import type { BookSection } from '@/components/PhoneBookPage/sections';
import { seededRandom } from './noise';

/** Makes a canvas. Injected so the painting can be tested without a browser canvas. */
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export const defaultCanvasFactory: CanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext('2d');
  if (!g) throw new Error('A 2D canvas is needed to paint the phone book.');
  return g;
}

type Side = 'L' | 'R';
type Rnd = () => number;

/** What the caller has done to this spread: listings dialled, and whether the corner is folded. */
export type PageMarks = { calledIds: readonly string[]; dogEared: boolean };
export const NO_MARKS: PageMarks = { calledIds: [], dogEared: false };

const CONDENSED = '"Arial Narrow", "DejaVu Sans Condensed", sans-serif';
const SERIF = '"DejaVu Serif", Georgia, serif';
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';
const INK = '#1a140c';

type Paper = {
  base: [number, number, number];
  fill: string;
  tint: [number, number, number];
  foxing: number;
};
const PAPER: Record<BookSection, Paper> = {
  /** Yellowed newsprint. */
  business: { base: [217, 201, 160], fill: '#d9c9a0', tint: [30, 8, -25], foxing: 160 },
  /** Plain paper that has gone a little grey, no yellow. */
  white: { base: [232, 228, 214], fill: '#e8e4d6', tint: [10, 4, -6], foxing: 70 },
};

/** Aged paper: darker at the edges and the gutter, fine noise, foxing, and a water tide mark on the right. */
function agedPaper(g: CanvasRenderingContext2D, side: Side, mode: BookSection, rnd: Rnd) {
  const { base, fill, tint, foxing } = PAPER[mode];
  const w = PAGE_W;
  const h = PAGE_H;
  g.fillStyle = fill;
  g.fillRect(0, 0, w, h);
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ex = Math.min(x, w - x) / w;
      const ey = Math.min(y, h - y) / h;
      const gutter = side === 'L' ? (w - x) / w : x / w;
      const edge = Math.max(0, 0.09 - Math.min(ex, ey)) * 7;
      const gut = Math.max(0, 0.1 - gutter) * 6;
      const n = (rnd() - 0.5) * 14;
      const k = 0.86 - edge * 0.55 - gut * 0.5 - (rnd() < 0.002 ? 0.2 : 0);
      d[i] = (base[0] + n) * k + edge * tint[0];
      d[i + 1] = (base[1] + n) * k + edge * tint[1];
      d[i + 2] = (base[2] + n) * k + edge * tint[2];
    }
  }
  g.putImageData(image, 0, 0);
  for (let k = 0; k < foxing; k++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 2 + rnd() * rnd() * 22;
    const gradient = g.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(120,70,25,${0.15 + rnd() * 0.3})`);
    gradient.addColorStop(1, 'rgba(120,70,25,0)');
    g.fillStyle = gradient;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  if (side === 'R') waterTide(g);
}

function waterTide(g: CanvasRenderingContext2D) {
  const cx = PAGE_W * 0.95;
  const cy = PAGE_H;
  const radius = PAGE_W * 0.42;
  const trace = () => {
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.04) {
      const r = radius * (0.92 + Math.sin(a * 6) * 0.035 + Math.sin(a * 17) * 0.015);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  };
  g.save();
  g.fillStyle = 'rgba(150,110,60,0.10)';
  trace();
  g.fill();
  g.filter = 'blur(2px)';
  g.strokeStyle = 'rgba(110,70,30,0.45)';
  g.lineWidth = 5;
  trace();
  g.stroke();
  g.filter = 'blur(6px)';
  g.strokeStyle = 'rgba(120,80,40,0.2)';
  g.lineWidth = 18;
  trace();
  g.stroke();
  g.restore();
}

function crossOut(g: CanvasRenderingContext2D, x: number, y: number, width: number, rnd: Rnd) {
  g.strokeStyle = 'rgba(120,15,10,0.85)';
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(x - 6, y - 6 + rnd() * 4);
  g.bezierCurveTo(x + width * 0.3, y - 10, x + width * 0.7, y + 12, x + width + 4, y + 8);
  g.stroke();
}

/** A business entry as the old book set it: bold name, address, and the numbers. */
function businessEntry(g: CanvasRenderingContext2D, { entry, x, y, width }: PlacedEntry, rnd: Rnd) {
  g.fillStyle = `rgba(22,16,10,${entry.ink})`;
  g.textAlign = 'left';
  g.font = `bold ${entry.real ? 21 : 20}px ${CONDENSED}`;
  g.fillText(entry.name, x, y, width);
  g.font = `17px ${CONDENSED}`;
  g.fillText(entry.address, x + 10, y + 21, width - 10);
  if (entry.real) {
    g.font = `italic 15px ${CONDENSED}`;
    g.fillText(entry.suburb, x + 10, y + 42, width * 0.3);
    g.textAlign = 'right';
    g.font = `bold 15px ${MONO}`;
    g.fillText(`${entry.exchange}  ${entry.phone ?? ''}`, x + width, y + 42, width * 0.68);
    g.textAlign = 'left';
    if (entry.boxed) {
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.strokeRect(x - 8, y - 24, width + 16, 82);
    }
  } else {
    g.textAlign = 'right';
    g.font = `bold 17px ${MONO}`;
    g.fillText(entry.exchange, x + width, y + 21);
    g.textAlign = 'left';
    g.font = `17px ${CONDENSED}`;
    g.fillStyle = `rgba(22,16,10,${entry.ink * 0.6})`;
    const reach = g.measureText(entry.address).width;
    for (let dx = x + 20 + reach; dx < x + width - 100; dx += 7) g.fillRect(dx, y + 18, 1.5, 1.5);
  }
  if (entry.crossed) crossOut(g, x, y, width, rnd);
}

/** A white pages entry: SURNAME Initial and the number on one line, address under it. */
function whiteEntry(g: CanvasRenderingContext2D, { entry, x, y, width }: PlacedEntry, rnd: Rnd) {
  g.fillStyle = `rgba(22,16,10,${entry.ink})`;
  g.textAlign = 'left';
  g.font = `bold ${entry.real ? 18 : 17}px ${CONDENSED}`;
  g.fillText(entry.name, x, y, width * 0.55);
  g.font = `14px ${CONDENSED}`;
  const where = entry.suburb ? `${entry.address}, ${entry.suburb}` : entry.address;
  g.fillText(where, x + 8, y + 19, width * (entry.real ? 0.5 : 0.9));
  g.textAlign = 'right';
  g.font = `bold 14px ${MONO}`;
  g.fillText(entry.exchange, x + width, y, width * 0.44);
  if (entry.phone) g.fillText(entry.phone, x + width, y + 19, width * 0.48);
  g.textAlign = 'left';
  if (entry.crossed) crossOut(g, x, y, width, rnd);
}

function runningHead(g: CanvasRenderingContext2D, page: PageLayout, side: Side) {
  const x0 = side === 'L' ? 70 : 110;
  g.fillStyle = INK;
  g.font = `bold 34px ${CONDENSED}`;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillText(page.headLeft, x0, 80);
  g.textAlign = 'right';
  g.fillText(page.headRight, PAGE_W - (side === 'L' ? 80 : 70), 80);
  g.textAlign = 'left';
  g.fillRect(x0, 96, PAGE_W - x0 - 70, 3);
}

function advert(g: CanvasRenderingContext2D) {
  const { x, y, w, h } = ADVERT;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.strokeRect(x, y, w, h);
  g.lineWidth = 1.5;
  g.strokeRect(x + 10, y + 10, w - 20, h - 20);
  g.fillStyle = INK;
  g.textAlign = 'center';
  const [name, subtitle, services, promise] = ADVERT_LINES;
  g.font = `bold 54px ${SERIF}`;
  g.fillText(name, x + w / 2, y + 85, w - 40);
  g.font = `italic 30px ${SERIF}`;
  g.fillText(subtitle, x + w / 2, y + 130);
  g.font = `26px ${CONDENSED}`;
  g.fillText(services, x + w / 2, y + 180);
  g.fillText(promise, x + w / 2, y + 220);
  g.font = `bold 40px ${MONO}`;
  g.fillText(ADVERT_DIAL_NUMBER, x + w / 2, y + 275);
  g.textAlign = 'left';
}

/** The empty page: a plain printed notice, so a search that found nothing never shows a blank page. */
function noListings(g: CanvasRenderingContext2D) {
  const cx = PAGE_W / 2;
  const y = PAGE_H * 0.4;
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.fillRect(100, y - 90, PAGE_W - 200, 3);
  g.font = `bold 66px ${SERIF}`;
  g.fillText(NO_LISTINGS_LINES[0], cx, y, PAGE_W - 200);
  g.font = `italic 44px ${SERIF}`;
  g.fillText(NO_LISTINGS_LINES[1], cx, y + 66, PAGE_W - 200);
  g.fillRect(100, y + 110, PAGE_W - 200, 3);
  g.textAlign = 'left';
}
function handwrittenNote(g: CanvasRenderingContext2D) {
  g.save();
  g.translate(PAGE_W - 520, PAGE_H - 110);
  g.rotate(-0.12);
  g.fillStyle = 'rgba(30,30,80,0.85)';
  g.font = `italic 46px ${SERIF}`;
  g.fillText("don't answer if it", 0, 0);
  g.fillText('rings at 3am', 30, 52);
  g.restore();
}

/** Everything printed or written on the page, on a transparent layer. */
function printLayer(g: CanvasRenderingContext2D, layout: BookLayout, side: Side, rnd: Rnd) {
  const page = side === 'L' ? layout.left : layout.right;
  runningHead(g, page, side);
  for (const placed of page.entries) {
    if (layout.mode === 'white') whiteEntry(g, placed, rnd);
    else businessEntry(g, placed, rnd);
  }
  if (side === 'L' && layout.advert) advert(g);
  if (side === 'L' && layout.empty) noListings(g);
  if (side === 'R') handwrittenNote(g);
}

function rubbedPatches(g: CanvasRenderingContext2D, rnd: Rnd) {
  for (let k = 0; k < 14; k++) {
    const x = rnd() * PAGE_W;
    const y = rnd() * PAGE_H;
    const r = 40 + rnd() * 160;
    const gradient = g.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(205,188,145,${0.25 + rnd() * 0.35})`);
    gradient.addColorStop(1, 'rgba(205,188,145,0)');
    g.fillStyle = gradient;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Tiny paper-coloured specks over the print, so some letters look broken. */
function brokenLetters(g: CanvasRenderingContext2D, rnd: Rnd) {
  g.save();
  g.globalCompositeOperation = 'lighten';
  g.fillStyle = 'rgba(200,184,140,0.85)';
  for (let k = 0; k < 2500; k++) {
    g.fillRect(rnd() * PAGE_W, rnd() * PAGE_H, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  g.restore();
}

function fingerprints(g: CanvasRenderingContext2D, side: Side, rnd: Rnd) {
  for (let k = 0; k < 3; k++) {
    const x = side === 'R' ? PAGE_W - 120 + rnd() * 40 : 80 + rnd() * 40;
    const y = PAGE_H - 200 + rnd() * 80;
    g.save();
    g.translate(x, y);
    g.rotate(rnd() * 3);
    for (let r = 4; r < 34; r += 3) {
      g.strokeStyle = `rgba(60,40,20,${0.08 + rnd() * 0.05})`;
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(0, 0, r, r * 1.35, 0, 0, Math.PI * 1.7);
      g.stroke();
    }
    g.restore();
  }
}

/** A number from text, so each ring is drawn the same way every time but no two look alike. */
function seedFor(text: string): number {
  let hash = 7;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * A hand-drawn ring round a listing, in soft graphite: a slightly uneven ellipse that does not
 * quite close, drawn twice. It has its own generator, so it never changes the rest of the page.
 */
function pencilRing(g: CanvasRenderingContext2D, placed: PlacedEntry, mode: BookSection) {
  const rnd = seededRandom(seedFor(placed.entry.id ?? ''));
  const cell = cellOf(placed, mode);
  const cx = cell.x + cell.w / 2;
  const cy = cell.y + cell.h / 2;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [alpha, width] of [
    [0.7, 2.6],
    [0.5, 1.8],
  ] as const) {
    const wobble = rnd() * Math.PI * 2;
    const start = rnd() * Math.PI * 2;
    g.strokeStyle = `rgba(78,78,86,${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.35; a += 0.05) {
      // The radius creeps outwards as the pencil goes round, so the ends miss each other.
      const creep = 1 + (a / (Math.PI * 2)) * 0.06;
      const uneven = 1 + Math.sin(a * 3 + wobble) * 0.03 + (rnd() - 0.5) * 0.015;
      const rx = (cell.w / 2 + 8) * creep * uneven;
      const ry = (cell.h / 2 + 3) * creep * uneven;
      g.lineTo(cx + Math.cos(a + start) * rx, cy + Math.sin(a + start) * ry);
    }
    g.stroke();
  }
  g.restore();
}

/** The top outer corner folded down over the page, with the page block showing where it was. */
function dogEar(g: CanvasRenderingContext2D, mode: BookSection) {
  const s = 96;
  const w = PAGE_W;
  g.save();
  g.fillStyle = '#6f5f42';
  g.beginPath();
  g.moveTo(w - s, 0);
  g.lineTo(w, 0);
  g.lineTo(w, s);
  g.closePath();
  g.fill();
  // The back of the paper is a little lighter than the front, and its edge casts a thin shadow.
  g.shadowColor = 'rgba(30,18,6,0.55)';
  g.shadowBlur = 10;
  g.shadowOffsetX = -2;
  g.shadowOffsetY = 3;
  g.fillStyle = PAPER[mode].fill;
  g.beginPath();
  g.moveTo(w - s, 0);
  g.lineTo(w, s);
  g.lineTo(w - s, s);
  g.closePath();
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = 'rgba(255,248,225,0.22)';
  g.fill();
  g.strokeStyle = 'rgba(70,45,20,0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(w - s, 0);
  g.lineTo(w, s);
  g.stroke();
  g.restore();
}

const PAGE_SEED: Record<Side, number> = { L: 13, R: 29 };

/**
 * Paints one page. The print goes on its own layer so it can be laid down twice: blurred first, as
 * ink bleeding into the fibres, then sharp. The pencil rings go on top of the print, and rubbed patches, specks and fingerprints wear them with the rest. The folded corner is last.
 * The generator is seeded, so every run makes the same page.
 */
export function paintPage(
  create: CanvasFactory,
  layout: BookLayout,
  side: Side,
  marks: PageMarks = NO_MARKS,
): HTMLCanvasElement {
  const rnd = seededRandom(PAGE_SEED[side]);
  const canvas = create(PAGE_W, PAGE_H);
  const g = context2d(canvas);
  agedPaper(g, side, layout.mode, rnd);

  const ink = create(PAGE_W, PAGE_H);
  printLayer(context2d(ink), layout, side, rnd);
  g.save();
  g.globalAlpha = 0.35;
  g.filter = 'blur(1.6px)';
  g.drawImage(ink, 0, 0);
  g.restore();
  g.save();
  g.filter = 'blur(0.4px)';
  g.drawImage(ink, 0, 0);
  g.restore();
  // The layer is no use once it is on the page, so give its memory back.
  ink.width = 0;
  ink.height = 0;

  const page = side === 'L' ? layout.left : layout.right;
  for (const placed of page.entries) {
    if (placed.entry.id !== null && marks.calledIds.includes(placed.entry.id)) {
      pencilRing(g, placed, layout.mode);
    }
  }

  rubbedPatches(g, rnd);
  brokenLetters(g, rnd);
  fingerprints(g, side, rnd);
  if (side === 'R' && marks.dogEared) dogEar(g, layout.mode);
  return canvas;
}

/** The striped edge of the page block: many pages seen end on, grimy at the sides. */
export function paintEdge(create: CanvasFactory): HTMLCanvasElement {
  const rnd = seededRandom(41);
  const canvas = create(64, 1024);
  const g = context2d(canvas);
  for (let y = 0; y < 1024; y++) {
    const v = 150 + rnd() * 60 - (rnd() < 0.3 ? 70 : 0);
    g.fillStyle = `rgb(${v},${v * 0.86},${v * 0.6})`;
    g.fillRect(0, y, 64, 1);
  }
  const grime = g.createLinearGradient(0, 0, 64, 0);
  grime.addColorStop(0, 'rgba(60,35,10,0.5)');
  grime.addColorStop(0.5, 'rgba(60,35,10,0.1)');
  grime.addColorStop(1, 'rgba(60,35,10,0.5)');
  g.fillStyle = grime;
  g.fillRect(0, 0, 64, 1024);
  return canvas;
}

/** Worn cloth for the cover boards. */
export function paintCover(create: CanvasFactory): HTMLCanvasElement {
  const rnd = seededRandom(53);
  const canvas = create(512, 512);
  const g = context2d(canvas);
  g.fillStyle = '#3d1a12';
  g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 9000; k++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '120,80,50'},${rnd() * 0.12})`;
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1);
  }
  for (let k = 0; k < 30; k++) {
    g.fillStyle = `rgba(150,110,70,${rnd() * 0.25})`;
    g.beginPath();
    g.arc(rnd() * 512, rnd() * 512, rnd() * 40, 0, 7);
    g.fill();
  }
  return canvas;
}
