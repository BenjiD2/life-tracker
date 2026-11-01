import { useEffect, useState } from 'react';

/** A text or number field that saves on blur or Enter, and only when the value changed. Escape reverts. */
export function InlineText({
  value, onSave, type = 'text', width, placeholder, label, list, id, min, max, required = false,
}: {
  value: string;
  onSave: (next: string) => void;
  type?: 'text' | 'number' | 'date';
  width?: string;
  placeholder?: string;
  label: string;
  /** id of a <datalist> to suggest values from. */
  list?: string;
  id?: string;
  min?: number;
  max?: number;
  /** Blank means "no value" and reverts rather than saving; a number field would otherwise save 0. */
  required?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      id={id}
      type={type}
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      list={list}
      min={min}
      max={max}
      style={{ width }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === value) return;
        if (required && draft.trim() === '') setDraft(value);
        else onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}
