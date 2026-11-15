'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { DIGITS, type Digit } from '@/lib/dial';
import type { DialController } from './useDialController';

/** True if the key press is going into a text field, where digits are for typing. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Lets the number keys dial from anywhere on the page. Held keys, shortcuts such as Ctrl+5
 * and typing in a text field are left alone.
 */
export function useDialKeyboard(controller: Pick<DialController, 'press'>): void {
  const latest = useRef(controller.press);
  useLayoutEffect(() => {
    latest.current = controller.press;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const digit = DIGITS.find((d: Digit) => d === event.key);
      if (!digit || isTyping(event.target)) return;
      latest.current(digit);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
