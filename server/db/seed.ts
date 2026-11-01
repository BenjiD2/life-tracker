import type { Db } from './client';
import { areas, trackers } from './schema';

const SEED: { name: string; color: string; trackers: { name: string; kind: 'quantity' | 'rating'; unit: string | null }[] }[] = [
  {
    name: 'Fitness',
    color: '#2a78d6',
    trackers: [
      { name: 'Tennis', kind: 'quantity', unit: 'minutes' },
      { name: 'Pickleball', kind: 'quantity', unit: 'minutes' },
      { name: 'Lifting', kind: 'quantity', unit: 'minutes' },
    ],
  },
  { name: 'Habits', color: '#eb6834', trackers: [] },
  { name: 'Mood', color: '#1baf7a', trackers: [{ name: 'Mood', kind: 'rating', unit: null }] },
  {
    name: 'Learning',
    color: '#eda100',
    trackers: [
      { name: 'Chinese study', kind: 'quantity', unit: 'minutes' },
      { name: 'CS study', kind: 'quantity', unit: 'minutes' },
    ],
  },
  { name: 'Reading', color: '#e87ba4', trackers: [] },
];

/** Inserts the starting areas and trackers (spec §3) into an empty database. No-op if any area exists. */
export function seedIfEmpty(db: Db): void {
  db.transaction((tx) => {
    if (tx.select({ id: areas.id }).from(areas).limit(1).all().length > 0) return;
    for (const a of SEED) {
      const { id } = tx.insert(areas).values({ name: a.name, color: a.color }).returning({ id: areas.id }).get();
      for (const t of a.trackers) tx.insert(trackers).values({ areaId: id, ...t }).run();
    }
  });
}
