const COMBINING_MARKS = /\p{M}+/gu;

export function normalizeSearchText(value: string) {
  return value.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase();
}

export function accentInsensitiveCommandFilter(
  value: string,
  search: string,
  keywords: string[] = [],
) {
  const normalizedSearch = normalizeSearchText(search).trim();
  if (!normalizedSearch) return 1;

  const normalizedValue = normalizeSearchText([value, ...keywords].join(" "));
  return normalizedValue.includes(normalizedSearch) ? 1 : 0;
}
