/** Shared so the lists agree on how a dialled listing is marked, and so they share one empty array. */
export const NO_CALLS: readonly string[] = [];

/** The text twin of the pencil ring. */
export function CalledLabel() {
  return <span className="block text-sm text-stone-700 italic">called</span>;
}
