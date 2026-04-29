export const ANSWER_ENTRY_SOURCES = [
  "popular",
  "history",
  "notification",
] as const;

export type AnswerEntrySource = (typeof ANSWER_ENTRY_SOURCES)[number];

export function isAnswerEntrySource(value: string | null): value is AnswerEntrySource {
  return ANSWER_ENTRY_SOURCES.some((source) => source === value);
}

export function buildAnswerEntryHref(
  answerId: string,
  source?: AnswerEntrySource,
): string {
  const basePath = `/answers/${encodeURIComponent(answerId)}`;

  if (!source) {
    return basePath;
  }

  return `${basePath}?entry=${encodeURIComponent(source)}`;
}
