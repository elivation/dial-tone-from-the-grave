import * as THREE from 'three';
import { GOO } from './sceneConstants';

const thick = new THREE.Color(GOO.thickColour);
const thin = new THREE.Color(GOO.thinColour);
const crusted = new THREE.Color(GOO.crustColour);

/** Slime colour for a thickness from 0 (a thin film at the edge) to 1 (the thick middle). */
export function gooColourAt(thickness: number): THREE.Color {
  // Green only where it is thick: the curve keeps most of the goo murky.
  return thin.clone().lerp(thick, Math.pow(THREE.MathUtils.clamp(thickness, 0, 1), GOO.greenCurve));
}

/**
 * Colours a mesh by how thick the slime is at each vertex, so thin edges and stains go
 * dark olive and the thick middle stays deep green. The material needs vertexColors on.
 */
export function paintGoo(
  geometry: THREE.BufferGeometry,
  thicknessAt: (index: number, position: THREE.Vector3) => number,
  crustAt: (index: number, position: THREE.Vector3) => number = () => 0,
): void {
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const crust = new Float32Array(position.count);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const age = THREE.MathUtils.clamp(crustAt(i, vertex), 0, 1);
    crust[i] = age;
    // Old goo dries towards a dark brown-olive crust.
    gooColourAt(thicknessAt(i, vertex))
      .lerp(crusted, age * GOO.crustDarkening)
      .toArray(colours, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute('crust', new THREE.BufferAttribute(crust, 1));
}

/**
 * Turns the standard physical material into slime. The glow takes the slime's own colour at each
 * point, and only where the goo is thick: thin edges stay murky and opaque. Each vertex's `crust`
 * (0 fresh, 1 dried) then makes old goo rough, dull, opaque and barely glowing, so fresh goo stays
 * glossy and wet beside it.
 */
export function glowWithSlimeColour(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    if (shader.vertexShader) {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float crust;\nattribute float thickness;\nvarying float vCrust;\nvarying float vThick;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvCrust = crust;\nvThick = thickness;',
        );
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vCrust;\nvarying float vThick;',
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, ${GOO.crustRoughness.toFixed(2)}, vCrust );`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;\n// Light only gets into the thick middle, so only the middle glows.\ntotalEmissiveRadiance *= smoothstep( 0.55, 1.0, vThick ) * ( 1.0 - 0.85 * vCrust );',
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - 0.9 * vCrust;\nmaterial.clearcoatRoughness = mix( material.clearcoatRoughness, 0.6, vCrust );\n#endif',
      )
      .replace(
        '#include <transmission_fragment>',
        THREE.ShaderChunk.transmission_fragment.replace(
          'material.transmission = transmission;',
          'material.transmission = transmission * ( 1.0 - vCrust ) * smoothstep( 0.35, 1.0, vThick );',
        ),
      );
  };
  material.customProgramCacheKey = () => 'goo-slime';
}
