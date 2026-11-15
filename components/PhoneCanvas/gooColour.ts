import * as THREE from 'three';
import { GOO } from './sceneConstants';

const thick = new THREE.Color(GOO.thickColour);
const thin = new THREE.Color(GOO.thinColour);

/** Slime colour for a thickness from 0 (a thin film at the edge) to 1 (the thick middle). */
export function gooColourAt(thickness: number): THREE.Color {
  return thin.clone().lerp(thick, THREE.MathUtils.clamp(thickness, 0, 1));
}

/**
 * Colours a mesh by how thick the slime is at each vertex, so thin edges and stains go
 * dark olive and the thick middle stays deep green. The material needs vertexColors on.
 */
export function paintGoo(
  geometry: THREE.BufferGeometry,
  thicknessAt: (index: number, position: THREE.Vector3) => number,
): void {
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    gooColourAt(thicknessAt(i, vertex)).toArray(colours, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}

/**
 * Makes the faint inner glow take the slime's own colour at each point. A plain emissive colour
 * paints every pixel the same green and hides the thickness gradient. This way thin edges
 * glow dark olive and the thick middle glows green.
 */
export function glowWithSlimeColour(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;',
    );
  };
  material.customProgramCacheKey = () => 'goo-slime';
}
