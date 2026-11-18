import { INCOMING_MESSAGES } from '@/lib/incoming';

/** The line from the phone that rang by itself, shown as text whether or not it is also spoken. */
export function IncomingMessage({ messageIndex }: { messageIndex: number }) {
  const text = INCOMING_MESSAGES[messageIndex];
  if (!text) return null;
  return (
    <section
      role="log"
      aria-live="polite"
      aria-label="Message from the line"
      className="pointer-events-auto w-full max-w-md rounded border border-amber-200/30 bg-black/75 p-3 font-serif text-amber-100"
    >
      <p>{text}</p>
    </section>
  );
}
