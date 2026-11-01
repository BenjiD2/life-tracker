import { useEffect, useState } from 'react';

/** A text or number field that saves on blur or Enter, and only when the value changed. Escape reverts. */
export function InlineText({
  value, onSave, type = 'text', width, placeholder, label, list,
}: {
  value: string;
  onSave: (next: string) => void;
  type?: 'text' | 'number' | 'date';
  width?: string;
  placeholder?: string;
  label: string;
  /** id of a <datalist> to suggest values from. */
  list?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type={type}
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      list={list}
      style={{ width }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}
