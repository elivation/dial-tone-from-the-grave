'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { BookSection } from '@/components/PhoneBookPage/sections';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import type { Listing } from '@/lib/sse';
import { blockGeometry, buildCentipede, coverGeometry, coverX, pageGeometry } from './bookGeometry';
import { createCoverTextures, createPageTextures } from './bookTextures';
import { BOOK_APPEAR_SECONDS, BOOK_POSITION, BOOK_ROTATION_Y, BOOK_SCALE } from './sceneConstants';

/** What the book shows: the results of the last search and the section that is open. */
export type BookView = {
  results: readonly Listing[];
  activeSection: BookSection;
};
type Props = BookView;

/** How high above the desk the book starts before it is laid down, in metres of book space. */
const DROP_HEIGHT = 0.08;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Frees GPU buffers when the thing that owns them goes away. */
function useDisposed(...items: Array<{ dispose: () => void }>) {
  useEffect(
    () => () => items.forEach((item) => item.dispose()),
    // The items are stable for the life of what made them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    items,
  );
}

function Book({ results, activeSection }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const lowered = useRef<THREE.Group>(null);
  const progress = useRef(reducedMotion ? 1 : 0);

  // Painting is slow, so it happens once per set of results and section, never per frame.
  const pages = useMemo(() => createPageTextures(results, activeSection), [results, activeSection]);
  const cloth = useMemo(() => createCoverTextures(), []);
  const geometry = useMemo(
    () => ({
      left: pageGeometry('L'),
      right: pageGeometry('R'),
      leftBlock: blockGeometry('L'),
      rightBlock: blockGeometry('R'),
      cover: coverGeometry(),
    }),
    [],
  );
  const centipede = useMemo(() => buildCentipede(), []);
  const edgeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: cloth.edge,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    [cloth],
  );

  useDisposed(pages);
  useDisposed(cloth, edgeMaterial);
  useDisposed(...Object.values(geometry));
  useDisposed(centipede);

  useFrame((_, delta) => {
    const group = lowered.current;
    if (!group || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta / BOOK_APPEAR_SECONDS);
    group.position.y = DROP_HEIGHT * (1 - easeOutCubic(progress.current));
  });

  return (
    <group
      name="phone-book"
      position={BOOK_POSITION}
      rotation-y={BOOK_ROTATION_Y}
      scale={BOOK_SCALE}
    >
      <group ref={lowered} position-y={reducedMotion ? 0 : DROP_HEIGHT}>
        {(['left', 'right'] as const).map((side) => (
          <group key={side}>
            <mesh geometry={geometry[side]} castShadow receiveShadow>
              <meshStandardMaterial map={pages[side]} roughness={0.92} side={THREE.DoubleSide} />
            </mesh>
            <mesh
              geometry={side === 'left' ? geometry.leftBlock : geometry.rightBlock}
              material={[blockMaterial, edgeMaterial]}
              castShadow
              receiveShadow
            />
          </group>
        ))}
        {([-1, 1] as const).map((s) => (
          <mesh
            key={s}
            geometry={geometry.cover}
            position={[coverX(s), 0.002, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial map={cloth.cover} roughness={0.95} />
          </mesh>
        ))}
        <primitive object={centipede.group} />
      </group>
    </group>
  );
}

/** Colour for the end of the page block that no stripes cover. Shared, it never changes. */
const blockMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a7a58,
  roughness: 1,
  side: THREE.DoubleSide,
});

/**
 * The open phone book, lying on the desk to the right of the phone. The parent mounts it once a
 * search has come back, and a search that found nothing gets a book with an empty page (Req 9.9).
 */
export function PhoneBook3D({ results, activeSection }: Props) {
  return <Book results={results} activeSection={activeSection} />;
}
