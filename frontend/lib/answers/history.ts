import { ApiClientError } from "@/lib/api/http";
import { AnswerPreviewSummary } from "@/lib/answers/types";
import { getAnswerTaskSummaries } from "@/lib/answers/task-store";

const DUPLICATE_CHECK_WINDOW_MS = 10 * 60 * 1000;

function normalizeComparableCheck(check: string): string {
  return check.trim().replace(/\s+/g, " ").toLowerCase();
}

function getCreatedAtTime(answer: AnswerPreviewSummary): number {
  const time = new Date(answer.createdAt).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function isLocalPendingSummary(answer: AnswerPreviewSummary): boolean {
  return answer.answerId.startsWith("pending:");
}

function shouldTreatAsDuplicateCheck(
  left: AnswerPreviewSummary,
  right: AnswerPreviewSummary,
): boolean {
  const leftCheck = normalizeComparableCheck(left.check);
  const rightCheck = normalizeComparableCheck(right.check);

  if (!leftCheck || leftCheck !== rightCheck) {
    return false;
  }

  return (
    Math.abs(getCreatedAtTime(left) - getCreatedAtTime(right)) <=
    DUPLICATE_CHECK_WINDOW_MS
  );
}

function chooseRepresentativeAnswer(
  current: AnswerPreviewSummary,
  candidate: AnswerPreviewSummary,
): AnswerPreviewSummary {
  const currentIsPending = isLocalPendingSummary(current);
  const candidateIsPending = isLocalPendingSummary(candidate);

  if (currentIsPending !== candidateIsPending) {
    return candidateIsPending ? current : candidate;
  }

  if (current.selectedSourceCount !== candidate.selectedSourceCount) {
    return current.selectedSourceCount > candidate.selectedSourceCount
      ? current
      : candidate;
  }

  return getCreatedAtTime(current) >= getCreatedAtTime(candidate)
    ? current
    : candidate;
}

function dedupeDuplicateCheckSubmissions(
  answers: AnswerPreviewSummary[],
): AnswerPreviewSummary[] {
  const deduped: AnswerPreviewSummary[] = [];

  answers.forEach((answer) => {
    const duplicateIndex = deduped.findIndex((existing) =>
      shouldTreatAsDuplicateCheck(existing, answer),
    );

    if (duplicateIndex === -1) {
      deduped.push(answer);
      return;
    }

    deduped[duplicateIndex] = chooseRepresentativeAnswer(
      deduped[duplicateIndex],
      answer,
    );
  });

  return deduped;
}

export function mergeAnswerSummaries(
  serverAnswers: AnswerPreviewSummary[],
  taskAnswers: AnswerPreviewSummary[],
): AnswerPreviewSummary[] {
  const merged = new Map<string, AnswerPreviewSummary>();
  const getMergeKey = (answer: AnswerPreviewSummary) =>
    answer.clientRequestId ?? answer.answerId;

  taskAnswers.forEach((taskAnswer) => {
    merged.set(getMergeKey(taskAnswer), taskAnswer);
  });

  serverAnswers.forEach((serverAnswer) => {
    merged.set(getMergeKey(serverAnswer), serverAnswer);
  });

  const sortedAnswers = Array.from(merged.values()).sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return dedupeDuplicateCheckSubmissions(sortedAnswers).sort(
    (left, right) => getCreatedAtTime(right) - getCreatedAtTime(left),
  );
}

export async function getMergedAnswerSummaries(
  fetchServerAnswers: () => Promise<AnswerPreviewSummary[]>,
): Promise<AnswerPreviewSummary[]> {
  const taskAnswers = getAnswerTaskSummaries();

  try {
    const serverAnswers = await fetchServerAnswers();

    return mergeAnswerSummaries(serverAnswers, taskAnswers);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }

      return mergeAnswerSummaries([], taskAnswers);
    }

    throw error;
  }
}
