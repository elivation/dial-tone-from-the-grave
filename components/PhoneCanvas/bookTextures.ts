import * as THREE from 'three';
import type { Listing } from '@/lib/sse';
import type { BookSection } from '@/components/PhoneBookPage/sections';
import { bookFor } from './bookContent';
import {
  defaultCanvasFactory,
  paintCover,
  paintEdge,
  paintPage,
  type CanvasFactory,
} from './bookPaint';

export type PageTextures = {
  left: THREE.CanvasTexture;
  right: THREE.CanvasTexture;
  /** Frees the GPU copies. The canvases go with them once nothing refers to them. */
  dispose: () => void;
};

export type CoverTextures = {
  edge: THREE.CanvasTexture;
  cover: THREE.CanvasTexture;
  dispose: () => void;
};

function toTexture(canvas: HTMLCanvasElement, anisotropy = 16): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Paints both pages for these results. Call once per book, not once per frame. */
export function createPageTextures(
  results: readonly Listing[],
  section: BookSection,
  create: CanvasFactory = defaultCanvasFactory,
): PageTextures {
  const layout = bookFor(results, section);
  const left = toTexture(paintPage(create, layout, 'L'));
  const right = toTexture(paintPage(create, layout, 'R'));
  return {
    left,
    right,
    dispose: () => {
      left.dispose();
      right.dispose();
    },
  };
}

/** The edge stripes and cloth, the same for every book. */
export function createCoverTextures(create: CanvasFactory = defaultCanvasFactory): CoverTextures {
  const edge = toTexture(paintEdge(create), 4);
  edge.wrapS = edge.wrapT = THREE.RepeatWrapping;
  edge.repeat.set(30, 0.05);
  edge.rotation = Math.PI / 2;
  const cover = toTexture(paintCover(create), 4);
  return {
    edge,
    cover,
    dispose: () => {
      edge.dispose();
      cover.dispose();
    },
  };
}
