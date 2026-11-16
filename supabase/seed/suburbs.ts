/** Parts of Johannesburg the listings come from, and the suburbs in each. */
export const REGIONS = {
  east: ['Edenvale', 'Bedfordview', 'Kempton Park', 'Germiston', 'Boksburg', 'Lombardy East'],
  north: ['Randburg', 'Northcliff', 'Fourways', 'Sandringham'],
  west: ['Roodepoort', 'Florida', 'Melville'],
  soweto: ['Orlando West', 'Diepkloof', 'Pimville'],
  south: ['Rosettenville', 'Turffontein'],
  central: ['Braamfontein'],
} as const;

export type Region = keyof typeof REGIONS;

/** The part of the city a suburb is in, or null if it is not one of ours. */
export function regionOf(suburb: string): Region | null {
  for (const [region, suburbs] of Object.entries(REGIONS) as Array<[Region, readonly string[]]>) {
    if (suburbs.includes(suburb)) return region;
  }
  return null;
}

/** Every suburb, east first, in a fixed order. */
export const SUBURBS: string[] = Object.values(REGIONS).flat();
