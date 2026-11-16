export const FICTION_NOTICE = 'All businesses, people and numbers in The Dead Pages are fictional.';

/** A small line at the foot of the page. It stays out of the way of the dial and the handset. */
export function FictionNotice() {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-1 z-10 text-center font-serif text-xs text-amber-200/60">
      {FICTION_NOTICE}
    </footer>
  );
}
