/** Row shapes for the seed data, matching the businesses and residents tables. */
export type BusinessSeed = {
  name: string;
  category: string;
  suburb: string;
  address: string;
  phone: string;
  /** The short number to dial on the rotary phone, five digits. Printed exchange style, e.g. HO 6-1001. */
  dial_number: string;
  hours: string;
  is_24hr: boolean;
  description: string;
  is_advert: boolean;
  is_spirit: boolean;
};

export type ResidentSeed = {
  surname: string;
  initials: string;
  suburb: string;
  address: string;
  phone: string;
  dial_number: string;
};

/** A listing number in the fictional 011 000 xxxx range, printed the way the book prints it. */
export const listingNumber = (n: number): string => `011 000 ${String(n).padStart(4, '0')}`;

/**
 * The text embedded for meaning-based search. A business is found by what it does and where, so
 * its name, trade, suburb and description all go in. A resident is found mostly by surname.
 */
export function embeddingText(
  listing: { kind: 'business'; row: BusinessSeed } | { kind: 'resident'; row: ResidentSeed },
): string {
  if (listing.kind === 'business') {
    const { name, category, suburb, description } = listing.row;
    return `${name}. ${category} in ${suburb}, Johannesburg. ${description}`;
  }
  const { surname, initials, suburb } = listing.row;
  return `${surname} ${initials}, a resident of ${suburb}, Johannesburg.`;
}
