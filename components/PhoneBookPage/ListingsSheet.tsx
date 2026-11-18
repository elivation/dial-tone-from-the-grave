'use client';
import { useEffect, useId, useRef, type Ref } from 'react';
import { CONTROL_BUTTON } from './panel';
import { PhoneBookPage } from './PhoneBookPage';

type SheetProps = Omit<Parameters<typeof PhoneBookPage>[0], 'layout' | 'onClose'> & {
  onClose: () => void;
};

/**
 * Opens the listings sheet. The 3D book is too small to tap on a phone, so below 768 px wide, or
 * in a landscape phone under 501 px tall, this button shows and the sheet gives the same listings
 * as a plain, readable list. The rule is in globals.css, so no script has to measure the screen.
 */
export function ListingsButton({
  onOpen,
  buttonRef,
}: {
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      className={`listings-button ${CONTROL_BUTTON} min-h-[44px]`}
    >
      Listings
    </button>
  );
}

/**
 * The current page of the book as an on-screen list, in a full screen modal dialog. It reuses the
 * book's own lists, tabs and page buttons, so it always agrees with the 3D book, and every listing
 * has a large Dial button. Dialling closes it first so the phone is in view. The browser handles
 * Escape and the focus trap.
 */
export function ListingsSheet({ onClose, onDial, ...book }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-amber-50 p-4 font-serif text-stone-900 backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-xl font-bold">
          Listings on this page
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="min-h-[44px] min-w-[44px] rounded border border-stone-900 px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        >
          Close listings
        </button>
      </div>
      <div className="mt-3">
        <PhoneBookPage
          {...book}
          layout="sheet"
          onClose={() => dialogRef.current?.close()}
          onDial={
            onDial &&
            ((digits) => {
              dialogRef.current?.close();
              onDial(digits);
            })
          }
        />
      </div>
    </dialog>
  );
}
