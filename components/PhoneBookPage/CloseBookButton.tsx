'use client';
import type { KeyboardEvent, Ref } from 'react';
import { CONTROL_BUTTON } from './panel';
/** Escape closes the book, unless it is already closing the listing detail dialog. */
export function closesBook(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape') return false;
  return !(event.target instanceof Element && event.target.closest('dialog'));
}
/** Puts the phone book away. Sits with the other controls, on screen for everyone. */
export function CloseBookButton({
  onClose,
  buttonRef,
}: {
  onClose: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClose}
      onKeyDown={(event) => {
        if (closesBook(event)) onClose();
      }}
      className={CONTROL_BUTTON}
    >
      Close the book
    </button>
  );
}
