'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { BookSection } from '@/components/PhoneBookPage/sections';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import type { Listing } from '@/lib/sse';
import { listingAt } from './bookHits';
import { FlipHint } from './FlipHint';
import { flipFromStrip, type PageSide } from './flipStrip';
import { blockGeometry, buildCentipede, coverGeometry, coverX, pageGeometry } from './bookGeometry';
import { createCoverTextures, createPageTextures, type PageTextures } from './bookTextures';
import { deckReducer, initDeck, liveItems, type Deck, type DeckAction } from './pageDeck';
import { createBackGeometry, createLeafGeometry, poseLeaf } from './leafGeometry';
import { TURN_SECONDS } from './pageTurn';
import { BOOK_APPEAR_SECONDS, BOOK_POSITION, BOOK_ROTATION_Y, BOOK_SCALE } from './sceneConstants';

/** What the book shows: the results of the last search and the section that is open. */
export type BookView = {
  results: readonly Listing[];
  activeSection: BookSection;
  /** Listings the caller has dialled from this page. They are ringed in pencil. */
  calledIds?: readonly string[] | undefined;
  /** The corner of the page is folded down. */
  dogEared?: boolean | undefined;
  /** A listing on the page was clicked or tapped. */
  onOpenListing?: ((id: string) => void) | undefined;
  /** The edge strip of a page was clicked: -1 on the left page turns back, 1 on the right page turns on. */
  onFlip?: ((by: -1 | 1) => void) | undefined;
  /** Which page of the session the book shows. A change of id with the book open turns the page. */
  pageId?: string | undefined;
  /** Where that page is in the session, from 0, which says which way the leaf turns. */
  pageIndex?: number | undefined;
  /** Which way the book can turn, so the cursor can say so. */
  canFlip?: { previous: boolean; next: boolean } | undefined;
};
type Props = BookView;

const NO_CALLS: readonly string[] = [];

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

function Book({
  results,
  activeSection,
  calledIds = NO_CALLS,
  dogEared = false,
  onOpenListing,
  onFlip,
  canFlip,
  pageId,
  pageIndex,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const getState = useThree((s) => s.get);
  const lowered = useRef<THREE.Group>(null);
  const progress = useRef(reducedMotion ? 1 : 0);

  // Painting is slow, so it happens once per change to the page, its section or its marks, never
  // per frame. Hovering only changes the cursor.
  const marks = useMemo(() => ({ calledIds, dogEared }), [calledIds, dogEared]);
  const painted = useMemo(
    () => createPageTextures(results, activeSection, marks),
    [results, activeSection, marks],
  );
  // The deck holds the pages on show, and the old ones a turning leaf still needs. It frees a
  // texture only when nothing draws it any more.
  const [deck, dispatch] = useReducer(
    (state: Deck<PageTextures>, action: DeckAction<PageTextures>) => deckReducer(state, action),
    undefined,
    () => initDeck(painted, pageId, pageIndex),
  );
  if (deck.current !== painted) {
    dispatch({
      type: 'show',
      next: painted,
      id: pageId,
      index: pageIndex,
      animate: !reducedMotion,
    });
  }
  const pages = deck.current;
  const turn = deck.turn;
  const turning = turn !== null;
  useEffect(() => {
    deck.garbage.forEach((old) => old.dispose());
  }, [deck.garbage]);
  const latestDeck = useRef(deck);
  useEffect(() => {
    latestDeck.current = deck;
  }, [deck]);
  useEffect(() => () => liveItems(latestDeck.current).forEach((live) => live.dispose()), []);
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

  const leaf = useMemo(() => {
    const front = createLeafGeometry();
    return { front, back: createBackGeometry(front) };
  }, []);
  useDisposed(leaf.front, leaf.back);
  useDisposed(cloth, edgeMaterial);
  useDisposed(...Object.values(geometry));
  useDisposed(centipede);

  const cursor = useRef('');
  const setCursor = useCallback(
    (value: string) => {
      if (cursor.current === value) return;
      cursor.current = value;
      getState().gl.domElement.style.cursor = value;
    },
    [getState],
  );
  useEffect(() => () => setCursor(''), [setCursor]);

  const listingUnder = (side: PageSide, event: ThreeEvent<MouseEvent | PointerEvent>) =>
    event.uv ? listingAt(pages.hits[side], event.uv.x, event.uv.y) : null;
  const canFlipFrom = (side: PageSide) => (side === 'left' ? canFlip?.previous : canFlip?.next);
  const onMove = (side: PageSide) => (event: ThreeEvent<PointerEvent>) => {
    if (turning) return setCursor('');
    const inStrip = event.uv !== undefined && flipFromStrip(side, event.uv.x) !== null;
    const pointer = listingUnder(side, event) !== null || (inStrip && canFlipFrom(side));
    setCursor(pointer ? 'pointer' : '');
  };
  const onClick = (side: PageSide) => (event: ThreeEvent<MouseEvent>) => {
    if (!event.uv || turning) return;
    const id = listingUnder(side, event);
    if (id !== null) {
      onOpenListing?.(id);
      return;
    }
    const by = flipFromStrip(side, event.uv.x);
    if (by !== null) onFlip?.(by);
  };

  const leafClock = useRef({ turnId: 0, seconds: 0 });
  useFrame((_, delta) => {
    if (turn) {
      const clock = leafClock.current;
      if (clock.turnId !== turn.id) {
        clock.turnId = turn.id;
        clock.seconds = 0;
      } else clock.seconds += delta;
      const progress = Math.min(1, clock.seconds / TURN_SECONDS);
      poseLeaf(leaf.front, turn.direction, progress);
      if (progress >= 1) dispatch({ type: 'finish' });
    }
    const group = lowered.current;
    if (!group || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta / BOOK_APPEAR_SECONDS);
    group.position.y = DROP_HEIGHT * (1 - easeOutCubic(progress.current));
  });

  // While a leaf is in the air the page it leaves from stays visible beneath it.
  const forward = turn?.direction !== -1;
  const shown = {
    left: turn && forward ? turn.from.left : pages.left,
    right: turn && !forward ? turn.from.right : pages.right,
  };
  const leafMaps = {
    front: turn ? (forward ? turn.from.right : pages.right) : pages.right,
    back: turn ? (forward ? pages.left : turn.from.left) : pages.left,
  };
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
            <FlipHint side={side} visible={!turning && canFlipFrom(side) === true} />
            <mesh
              name={`page-${side}`}
              geometry={geometry[side]}
              castShadow
              receiveShadow
              onClick={onClick(side)}
              onPointerMove={onMove(side)}
              onPointerOut={() => setCursor('')}
            >
              <meshStandardMaterial map={shown[side]} roughness={0.92} side={THREE.DoubleSide} />
            </mesh>
            <mesh
              geometry={side === 'left' ? geometry.leftBlock : geometry.rightBlock}
              material={[blockMaterial, edgeMaterial]}
              castShadow
              receiveShadow
            />
          </group>
        ))}
        <group name="page-turn" visible={turning}>
          <mesh
            name="leaf-front"
            geometry={leaf.front}
            frustumCulled={false}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial map={leafMaps.front} roughness={0.92} side={THREE.FrontSide} />
          </mesh>
          <mesh
            name="leaf-back"
            geometry={leaf.back}
            frustumCulled={false}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial map={leafMaps.back} roughness={0.92} side={THREE.BackSide} />
          </mesh>
        </group>
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
export function PhoneBook3D(props: Props) {
  return <Book {...props} />;
}
