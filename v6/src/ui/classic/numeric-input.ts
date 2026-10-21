import type { FocusEvent } from 'react';

/**
 * Keep an intentional zero, but remove zeroes accidentally retained in front
 * of another digit (for example, 0600 -> 600 and -05 -> -5).
 */
export function normalizeNumericInput(value: string) {
  return value.replace(/^(-?)0+(?=\d)/, '$1');
}

export function parseNumericInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Select the existing value so typing on touch keyboards replaces it. */
export function selectNumericInput(event: FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  input.select();
  window.requestAnimationFrame(() => input.select());
}
