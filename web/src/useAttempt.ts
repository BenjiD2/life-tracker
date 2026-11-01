import { useState } from 'react';
import { errorMessage } from './api';

export type Attempt = (key: string, write: () => Promise<unknown>) => Promise<void>;

/**
 * Runs writes so a failure lands under `key`, for showing next to the input that caused it, instead of throwing.
 * `after` always runs: a failed write may still have changed something, so the page re-reads what's true.
 */
export function useAttempt(after: () => Promise<unknown>) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const attempt: Attempt = async (key, write) => {
    try {
      await write();
      setErrors(({ [key]: _, ...rest }) => rest);
    } catch (e) {
      setErrors((prev) => ({ ...prev, [key]: errorMessage(e) }));
    }
    await after();
  };
  return { errors, attempt, clearErrors: () => setErrors({}) };
}
