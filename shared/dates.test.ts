import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isDateStr, periodBounds, todayLocal } from './dates';

describe('todayLocal', () => {
  it('uses local time, not UTC', () => {
    expect(todayLocal(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-31');
  });
});

describe('isDateStr', () => {
  it('accepts real dates in YYYY-MM-DD form', () => {
    expect(isDateStr('2026-02-28')).toBe(true);
  });
  it('rejects impossible dates and bad formats', () => {
    expect(isDateStr('2026-02-29')).toBe(false);
    expect(isDateStr('2026-1-05')).toBe(false);
  });
});

describe('addDays / daysBetween', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('counts days from a to b', () => {
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
  });
});

describe('periodBounds', () => {
  it('weeks run Monday–Sunday across the Sunday→Monday rollover', () => {
    // 2026-11-01 is a Sunday; 2026-11-02 is a Monday
    expect(periodBounds('2026-11-01', 'week')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(periodBounds('2026-11-02', 'week')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
  });
  it('months end on day 28, 30, and 31', () => {
    expect(periodBounds('2026-02-14', 'month')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(periodBounds('2026-04-30', 'month')).toEqual({ start: '2026-04-01', end: '2026-04-30' });
    expect(periodBounds('2026-12-05', 'month')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});
