import { daysBetween, periodBounds } from '../../shared/dates';
import type { Book, DateStr, Entry, Goal, GoalItem, GoalProgress } from '../../shared/types';
import { countInRange, periodStreak } from './streaks';

/** Where a completion goal should be today on a straight line from 0 at `created` to `target` at `deadline`. */
export function expectedByToday(target: number, created: DateStr, deadline: DateStr, today: DateStr): number {
  const total = daysBetween(created, deadline);
  if (total <= 0) return target; // deadline on or before creation: everything is due now
  const fraction = Math.min(1, Math.max(0, daysBetween(created, today) / total));
  return target * fraction;
}

/**
 * Progress for one goal. The caller pre-filters the data to this goal:
 * `activeDates` scoped to the goal's area or tracker (consistency),
 * `entries` to `sourceTrackerId`, `items` to the goal's checklist.
 */
export function goalProgress(
  goal: Goal,
  data: { activeDates: ReadonlySet<DateStr>; books: Book[]; entries: Entry[]; items: GoalItem[] },
  today: DateStr,
): GoalProgress {
  if (goal.type === 'consistency') {
    const period = goal.period ?? 'week';
    const target = goal.targetDays ?? 0;
    const { start, end } = periodBounds(today, period);
    const current = countInRange(data.activeDates, start, end);
    return {
      current,
      target,
      percent: percentOf(current, target),
      streak: periodStreak(data.activeDates, period, target, today),
      expected: null,
    };
  }

  let current: number;
  let target = goal.target ?? 0;
  switch (goal.source) {
    case 'books':
      current = data.books.filter(
        (b) =>
          b.status === 'done' &&
          b.finished !== null &&
          b.finished >= goal.created &&
          (goal.deadline === null || b.finished <= goal.deadline) &&
          (goal.bookTopic === null || b.topic === goal.bookTopic),
      ).length;
      break;
    case 'tracker':
      current = data.entries.reduce((sum, e) => sum + e.value, 0);
      break;
    case 'checklist':
      current = data.items.filter((i) => i.doneAt !== null).length;
      target = data.items.length;
      break;
    default:
      current = 0;
  }
  return {
    current,
    target,
    percent: percentOf(current, target),
    streak: null,
    expected: goal.deadline === null ? null : expectedByToday(target, goal.created, goal.deadline, today),
  };
}

function percentOf(current: number, target: number): number {
  return target === 0 ? 0 : Math.min(100, (current / target) * 100);
}
