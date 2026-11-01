import { describe, expect, it } from 'vitest';
import { isBooksArea } from './books-area';

describe('isBooksArea', () => {
  it('matches "Reading", ignoring case and surrounding spaces', () => {
    for (const name of ['Reading', 'reading', ' READING ']) expect(isBooksArea({ name })).toBe(true);
  });
  it('rejects other names', () => {
    for (const name of ['Fitness', 'Reading list']) expect(isBooksArea({ name })).toBe(false);
  });
});
