'use client';
import type { Ref } from 'react';
import { CONTROL_BUTTON } from './panel';

/**
 * Brings the phone book back after it was put away or the page was reloaded. It sits where Close
 * the book sits, so the control stays in one place.
 */
export function OpenBookButton({
  onOpen,
  buttonRef,
}: {
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={buttonRef} type="button" onClick={onOpen} className={CONTROL_BUTTON}>
      Open the book
    </button>
  );
}
