import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readFileSync } from 'fs';
import path from 'path';

/** GLTFLoader reads a browser global when it meets a WebP texture. Geometry is all the tests need. */
(globalThis as unknown as { self: unknown }).self = globalThis;

/** Loads the optimised phone model from disk, the way the browser would, without textures. */
export async function loadSourcePhone(): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const file = readFileSync(path.resolve(process.cwd(), 'public/models/we500.glb'));
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return (await loader.parseAsync(bytes, '')).scene;
}
