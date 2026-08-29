export function normalizeAffiliation(value: string): string {
  return value.trim().toLowerCase().split("@")[0];
}

export function getHighestAffiliation<T extends string>(
  values: string[],
  priority: readonly T[],
): T | null {
  const normalized = new Set(
    values.map(normalizeAffiliation).filter(Boolean),
  );

  for (const affiliation of priority) {
    if (normalized.has(affiliation)) {
      return affiliation;
    }
  }

  return null;
}
