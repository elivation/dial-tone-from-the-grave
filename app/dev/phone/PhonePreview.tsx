'use client';
import { useEffect, useState } from 'react';
import type { BookSection } from '@/components/PhoneBookPage/sections';
import { OpenedListing } from '@/components/PhoneBookPage/OpenedListing';
import {
  FIXTURE_BUSINESSES,
  FIXTURE_BUSINESSES_2,
  FIXTURE_RESIDENTS,
} from '@/components/PhoneCanvas/__fixtures__/book';
import type { Listing } from '@/lib/sse';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import { useDialController, type DialController } from '@/components/RotaryDial/useDialController';
import { replayPlan } from './replay';

/** The wheel follows the finger exactly while dragging, so a held 'dragging' phase pins it at `wheel` degrees. */
function heldAt(wheel: number): DialController {
  return {
    rotation: wheel,
    phase: 'dragging',
    activeDigit: null,
    disabled: true,
    reducedMotion: false,
    grab: () => false,
    drag: () => {},
    release: () => false,
    press: () => false,
  };
}

const POINTER = 1;

/**
 * Dev preview of the phone. With `dial`, it drags each digit round on the real dial controller,
 * as a finger would, and marks the page `data-replay="done"` when the dial is back at rest.
 * Without it, the wheel is held still at `wheel` degrees. With `book`, the phone book lies open on the desk
 * showing invented results for that section.
 */
export function PhonePreview({
  wheel,
  dial,
  book,
  page = 0,
  called = [],
  dogEared = false,
}: {
  wheel: number;
  dial: string;
  book: BookSection | null;
  /** Which page of the invented session the book opens on. */
  page?: number;
  /** Ids of listings to ring in pencil. */
  called?: readonly string[];
  dogEared?: boolean;
}) {
  const pages: Listing[][] =
    book === 'white' ? [FIXTURE_RESIDENTS] : [FIXTURE_BUSINESSES, FIXTURE_BUSINESSES_2];
  const [index, setIndex] = useState(Math.min(page, pages.length - 1));
  const [opened, setOpened] = useState<Listing | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(dial === '');
  const live = useDialController({ disabled: dial === '', onDigit: () => {} });
  const { grab, drag, release } = live;

  useEffect(() => {
    if (dial === '' || !ready) return;
    const plan = replayPlan(dial);
    const timers = plan.map((step) =>
      setTimeout(() => {
        if (step.kind === 'grab') grab(step.digit, step.angle, POINTER);
        else if (step.kind === 'drag') drag(step.angle, POINTER);
        else release(POINTER);
      }, step.at),
    );
    const last = plan.at(-1)?.at ?? 0;
    timers.push(setTimeout(() => setDone(true), last + 1500));
    return () => timers.forEach(clearTimeout);
  }, [dial, ready, grab, drag, release]);

  // Wait for the scene to finish loading before dragging, so no trail is lost.
  useEffect(() => {
    if (dial === '') return;
    const veilGone = () => document.querySelector('[aria-hidden="true"].opacity-0') !== null;
    const poll = setInterval(() => {
      if (veilGone()) {
        clearInterval(poll);
        setReady(true);
      }
    }, 200);
    return () => clearInterval(poll);
  }, [dial]);

  return (
    <main className="h-screen w-screen bg-black" data-replay={done ? 'done' : 'running'}>
      <PhoneCanvasLoader
        active
        controller={dial === '' ? heldAt(wheel) : live}
        book={
          book
            ? {
                results: pages[index] ?? [],
                pageId: `page-${index}`,
                pageIndex: index,
                activeSection: book,
                calledIds: called,
                dogEared,
                onOpenListing: (id) =>
                  setOpened((pages[index] ?? []).find((listing) => listing.id === id) ?? null),
                onFlip: (by) => setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + by))),
                canFlip: { previous: index > 0, next: index < pages.length - 1 },
              }
            : undefined
        }
      />
      {opened && (
        <OpenedListing listing={opened} onClose={() => setOpened(null)} onDial={() => {}} />
      )}
    </main>
  );
}
