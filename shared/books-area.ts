import type { Area } from './types';

/**
 * Books aren't linked to an area in the schema, so the area named "Reading" (the seeded one,
 * case-insensitive) is where reading counts: its active days include days with pages read.
 */
export const isBooksArea = (area: Pick<Area, 'name'>) => area.name.trim().toLowerCase() === 'reading';
