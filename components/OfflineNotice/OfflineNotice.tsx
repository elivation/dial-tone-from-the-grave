export const OFFLINE_MESSAGE = 'The exchange has gone dark. Check your connection.';

/**
 * Covers the whole scene while the browser is offline. It does not animate, so reduced motion
 * has nothing to turn off. The alert role makes screen readers announce it as soon as it appears.
 */
export function OfflineNotice() {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/95 p-8 text-center font-serif text-amber-100"
    >
      <p className="max-w-md text-2xl tracking-wide">{OFFLINE_MESSAGE}</p>
      <p className="text-sm text-amber-200/70">The line will pick up again by itself.</p>
    </div>
  );
}
