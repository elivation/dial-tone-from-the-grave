import { useEffect, useId, useRef } from 'react';
import { DialButton } from './DialButton';

export type DetailRow = { term: string; detail: string };

/**
 * One entry of the book in a modal dialog: a title, its facts, and a Dial button when the page
 * can dial. The browser handles Escape and the focus trap. It sits in the top layer, so it shows
 * on screen whichever part of the page it is rendered from.
 */
export function DetailDialog({
  title,
  rows,
  dial,
  onClose,
}: {
  title: string;
  rows: readonly DetailRow[];
  dial?: { dialNumber: string; name: string; onDial: (digits: string) => void } | undefined;
  onClose: () => void;
}) {
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
      className="m-auto w-[min(26rem,92vw)] rounded border-2 border-stone-900 bg-amber-50 p-5 font-serif text-stone-900 backdrop:bg-black/70"
    >
      <h2 id={titleId} className="text-xl font-bold">
        {title}
      </h2>
      <dl className="mt-3 space-y-1">
        {rows.map(({ term, detail }) => (
          <div key={term}>
            <dt className="text-sm font-bold text-stone-700">{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex gap-2">
        {dial && (
          <DialButton
            dialNumber={dial.dialNumber}
            name={dial.name}
            // The dialog closes first so the phone is in view.
            onDial={(digits) => {
              dialogRef.current?.close();
              dial.onDial(digits);
            }}
          />
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded border border-stone-900 px-4 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
