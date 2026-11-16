/**
 * A Dead Pages twist on every ordinary business name, so none can be mistaken for a real firm with
 * the same plain name. Old-fashioned and a little eerie, about the business and its telephone,
 * never about a person, a culture or an accent.
 */
const TWISTS: Array<(year: number) => string> = [
  (y) => `(Est. ${y}, Night Calls Only)`,
  () => '(Ring Twice After Dark)',
  (y) => `(Number Unchanged Since ${y})`,
  () => '(Ask for the Night Clerk)',
  (y) => `(Open Since ${y}, Never Closed)`,
  () => '(Calls Returned Eventually)',
  (y) => `(By Candlelight Since ${y})`,
  (y) => `(Still Answering Since ${y})`,
  () => '(Lamplight Branch)',
  (y) => `(Founded ${y}, Founder Still Present)`,
  () => '(Mind the Third Step)',
  () => '(Line Crackles, Please Persist)',
];

/** Matches any name that carries one of the twists. */
export const TWIST =
  /\((Est\. \d{4}, Night Calls Only|Ring Twice After Dark|Number Unchanged Since \d{4}|Ask for the Night Clerk|Open Since \d{4}, Never Closed|Calls Returned Eventually|By Candlelight Since \d{4}|Still Answering Since \d{4}|Lamplight Branch|Founded \d{4}, Founder Still Present|Mind the Third Step|Line Crackles, Please Persist)\)$/;

/** The `i`th ordinary business's name, with its twist and a founding year between 1931 and 1979. */
export function twisted(name: string, i: number): string {
  const twist = TWISTS[i % TWISTS.length] as (year: number) => string;
  return `${name} ${twist(1931 + ((i * 7) % 49))}`;
}
