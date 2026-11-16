// Both spellings of seance are listed because callers may type either.
export const SPOOKY_KEYWORDS: string[] = [
  'ghost',
  'haunt',
  'haunted',
  'seance',
  'séance',
  'spirit',
  'dead',
  'grave',
  'coffin',
  'witch',
  'vampire',
  'zombie',
  'cursed',
  'midnight',
];

export function isSpookyQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return SPOOKY_KEYWORDS.some((keyword) => lower.includes(keyword));
}
