import { describe, expect, it } from 'vitest';
import type { Book, Entry, Goal, GoalItem } from '../../shared/types';
import { expectedByToday, goalProgress } from './goals';

const goalBase: Goal = {
  id: 1, title: 'g', areaId: 1, type: 'consistency', created: '2026-01-01',
  scopeTrackerId: null, period: null, targetDays: null,
  source: null, target: null, deadline: null, sourceTrackerId: null, bookTopic: null,
};
const consistencyGoal = (o: Partial<Goal>): Goal => ({ ...goalBase, type: 'consistency', period: 'month', targetDays: 1, ...o });
const completionGoal = (o: Partial<Goal>): Goal =>
  ({ ...goalBase, type: 'completion', source: 'books', target: 1, deadline: '2026-12-31', ...o });
let nextId = 1;
const book = (o: Partial<Book>): Book => ({
  id: nextId++, title: 't', author: 'a', totalPages: 100, status: 'reading', topic: null, started: null, finished: null, ...o,
});
const entry = (value: number): Entry => ({ id: nextId++, trackerId: 1, date: `2026-10-${String(nextId % 28 + 1).padStart(2, '0')}`, value, note: null });
const item = (doneAt: string | null): GoalItem => ({ id: nextId++, goalId: 1, label: 'i', doneAt });
const none = { activeDates: new Set<string>(), books: [], entries: [], items: [] };

describe('expectedByToday', () => {
  it('is linear from created to deadline', () => {
    expect(expectedByToday(20, '2026-01-01', '2026-12-31', '2026-07-02')).toBeCloseTo(10);
  });
  it('equals the target on the deadline day', () => {
    expect(expectedByToday(20, '2026-01-01', '2026-12-31', '2026-12-31')).toBe(20);
  });
  it('is clamped to the target past the deadline, and to 0 before creation', () => {
    expect(expectedByToday(20, '2026-01-01', '2026-12-31', '2027-02-01')).toBe(20);
    expect(expectedByToday(20, '2026-01-01', '2026-12-31', '2025-12-01')).toBe(0);
  });
});

describe('goalProgress: consistency', () => {
  it('counts active days in the current period and reports the period streak', () => {
    const c = goalProgress(consistencyGoal({ period: 'month', targetDays: 12 }),
      { ...none, activeDates: new Set(['2026-09-30', '2026-10-01', '2026-10-02']) }, '2026-10-15');
    expect(c).toMatchObject({ current: 2, target: 12, expected: null });
    expect(c.streak).toBe(0);
  });
});

describe('goalProgress: completion', () => {
  const books = [
    book({ status: 'done', finished: '2026-03-01', topic: 'cs' }),
    book({ status: 'done', finished: '2025-12-30', topic: 'cs' }),
    book({ status: 'reading', finished: null, topic: 'cs' }),
  ];
  const g = completionGoal({ source: 'books', target: 20, created: '2026-01-01', deadline: '2026-12-31' });

  it('books: counts only done books finished within [created, deadline]', () => {
    expect(goalProgress(g, { ...none, books }, '2026-07-02'))
      .toMatchObject({ current: 1, target: 20, percent: 5, streak: null });
    expect(goalProgress(g, { ...none, books }, '2026-07-02').expected).toBeCloseTo(10);
  });
  it('books: applies the topic filter', () => {
    expect(goalProgress({ ...g, bookTopic: 'history' }, { ...none, books }, '2026-07-02').current).toBe(0);
  });
  it('tracker: sums entry values', () => {
    expect(goalProgress(completionGoal({ source: 'tracker', target: 500 }),
      { ...none, entries: [entry(120), entry(30)] }, '2026-10-15').current).toBe(150);
  });
  it('checklist: target is the item count', () => {
    expect(goalProgress(completionGoal({ source: 'checklist', target: 0 }),
      { ...none, items: [item('2026-10-01'), item('2026-10-02'), item(null)] }, '2026-10-15'))
      .toMatchObject({ current: 2, target: 3 });
  });
  it('checklist with zero items reports 0 / 0 at 0%, never NaN', () => {
    expect(goalProgress(completionGoal({ source: 'checklist', target: 0 }), none, '2026-10-15'))
      .toMatchObject({ current: 0, target: 0, percent: 0 });
  });
  it('no deadline → expected is null', () => {
    expect(goalProgress(completionGoal({ source: 'tracker', target: 500, deadline: null }), none, '2026-10-15').expected)
      .toBeNull();
  });
  it('past the deadline with no data: 0 current, expected at the full target', () => {
    expect(goalProgress(completionGoal({ source: 'tracker', target: 500 }), none, '2027-03-01'))
      .toMatchObject({ current: 0, percent: 0, expected: 500 });
  });
  it('percent is capped at 100', () => {
    expect(goalProgress(completionGoal({ source: 'tracker', target: 100 }),
      { ...none, entries: [entry(250)] }, '2026-10-15').percent).toBe(100);
  });
});
