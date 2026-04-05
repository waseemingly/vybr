/**
 * Normalizes music_lover_profiles favorite_* fields from Supabase/PowerSync.
 * Native clients often receive JSON array text (e.g. '["A","B"]'); web may get real arrays.
 */
export function parseMusicFavoriteList(
  value: string | string[] | null | undefined
): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    } catch {
      // fall through to CSV
    }
  }

  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
