import { or, sql, type SQLWrapper } from "drizzle-orm";

export type SearchPatternMode = "exact" | "prefix" | "contains";

export function escapeLikePattern(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function searchPattern(query: string, mode: SearchPatternMode) {
  const escaped = escapeLikePattern(query);
  if (mode === "exact") return escaped;
  if (mode === "prefix") return `${escaped}%`;
  return `%${escaped}%`;
}

export function accentInsensitiveLike(
  column: SQLWrapper,
  query: string,
  mode: SearchPatternMode = "contains",
) {
  const pattern = searchPattern(query, mode);
  return sql<boolean>`lower(public.unaccent('public.unaccent'::regdictionary, coalesce(${column}::text, ''))) like lower(public.unaccent('public.unaccent'::regdictionary, ${pattern})) escape E'\\\\'`;
}

export function accentInsensitiveMatchesAny(
  columns: SQLWrapper[],
  query: string,
  mode: SearchPatternMode = "contains",
) {
  return or(
    ...columns.map((column) => accentInsensitiveLike(column, query, mode)),
  )!;
}
