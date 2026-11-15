import type * as THREE from 'three';

/**
 * Settles a layer of dust on upward-facing surfaces by patching the standard shader.
 * Ported from the reference scene. `amount` is how much of the surface the dust covers.
 */
export function addDust(material: THREE.MeshStandardMaterial, amount: number): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos; varying vec3 vWNorm;
float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float up = clamp(normalize(vWNorm).y, 0.0, 1.0);
float dn = n3(vWPos * 260.0) * 0.5 + n3(vWPos * 55.0) * 0.5;
float dust = smoothstep(0.6, 0.98, up) * smoothstep(0.45, 0.85, dn) * ${amount.toFixed(2)};
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.38, 0.32), dust);
roughnessFactor = mix(roughnessFactor, 1.0, dust);`,
      );
  };
  // Materials with different amounts need different compiled programs.
  material.customProgramCacheKey = () => `dust-${amount.toFixed(2)}`;
  material.needsUpdate = true;
}
