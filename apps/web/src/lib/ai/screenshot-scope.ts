export const MATCH_CONTEXT_LIMIT = 200;

export function completeMatchScope<T>(rows: readonly T[] | null | undefined):
  | { complete: true; rows: readonly T[] }
  | { complete: false } {
  const values = rows ?? [];
  return values.length > MATCH_CONTEXT_LIMIT
    ? { complete: false }
    : { complete: true, rows: values };
}
