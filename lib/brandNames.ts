/**
 * Real directory, telecom and phone company names that must never appear in the app, the repo, the
 * seed data or the video (product rules). Our own names, The Dead Pages and its white pages, are fine.
 */
export const BRAND_NAMES = [
  'yellow pages',
  'telkom',
  'vodacom',
  'mtn',
  'cell c',
  'openserve',
  'neotel',
  'trudon',
  'liquid telecom',
  'british telecom',
  'verizon',
  'at&t',
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&');

/** The brand names found in `text`, matched as whole words in any case, in the order they first appear. */
export function findBrandNames(text: string): string[] {
  const lower = text.toLowerCase();
  const found: Array<{ name: string; at: number }> = [];
  for (const name of BRAND_NAMES) {
    const match = new RegExp(`(^|[^a-z0-9])${escape(name)}($|[^a-z0-9])`).exec(lower);
    if (match) found.push({ name, at: match.index });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.name);
}
