// Allowed values, shared by the database schema and the request schemas so the two can't drift.
export const KINDS = ['check', 'quantity', 'rating'] as const;
export const BOOK_STATUSES = ['reading', 'done', 'dropped'] as const;
export const GOAL_TYPES = ['consistency', 'completion'] as const;
export const GOAL_SOURCES = ['books', 'tracker', 'checklist'] as const;
export const PERIODS = ['week', 'month'] as const;
