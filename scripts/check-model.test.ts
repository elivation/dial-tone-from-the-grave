/**
 * Verifies that the optimised GLB at public/models/we500.glb still contains
 * all the named nodes that task 42 requires for 3D interaction.
 *
 * Run in Node environment (reads the filesystem directly).
 * This test must fail if gltf-transform optimize accidentally joins or
 * flattens the named meshes away.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const REQUIRED_NODES = [
  'Rotary_Dial_Finger_Wheel', // rotated to animate dialling
  'Rotary_Dial_Card', // receives handwritten "1023" canvas texture
  'Dial_Number_Plate', // used as raycast floor when positioning goo
  'Rotary_Dial_Finger_Stop', // visible reference for STOP_ANGLE
  'Handset', // animated on pick-up / hang-up
  'Main_Body', // receives dust shader
];

describe('public/models/we500.glb structure', () => {
  it('contains all required named nodes', () => {
    const glbPath = path.resolve(process.cwd(), 'public/models/we500.glb');
    const buf = readFileSync(glbPath);

    // GLB binary layout: 12-byte header, then chunks.
    // Chunk 0 is always JSON: length at byte 12, type at 16, data from byte 20.
    const jsonLen = buf.readUInt32LE(12);
    type GltfJson = { meshes?: Array<{ name?: string }>; nodes?: Array<{ name?: string }> };
    const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8')) as GltfJson;

    const names = new Set<string>();
    for (const m of json.meshes ?? []) if (m.name) names.add(m.name);
    for (const n of json.nodes ?? []) if (n.name) names.add(n.name);

    for (const required of REQUIRED_NODES) {
      const found = [...names].some((n) => n.includes(required));
      expect(found, `Node "${required}" missing from we500.glb — re-run pnpm optimize-assets`).toBe(
        true,
      );
    }
  });

  it('is under 5 MB', () => {
    const glbPath = path.resolve(process.cwd(), 'public/models/we500.glb');
    const size = readFileSync(glbPath).length;
    expect(
      size,
      `we500.glb is ${(size / 1_000_000).toFixed(2)} MB, target is under 5 MB`,
    ).toBeLessThan(5 * 1_000_000);
  });
});
