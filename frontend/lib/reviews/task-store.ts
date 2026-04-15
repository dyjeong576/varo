import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import { createReviewCompletionNotification } from "@/lib/notifications/store";
import {
  getReviewStageLabel,
  getReviewStatusLabel,
} from "@/lib/reviews/mappers";
import {
  ReviewPreviewDetail,
  ReviewPreviewSummary,
  ReviewTaskRecord,
} from "@/lib/reviews/types";

const STORAGE_KEY = "varo.review-tasks";
const CHANGE_EVENT = "varo-review-tasks-changed";
const MAX_TASKS = 20;

const inFlightRequests = new Map<string, Promise<void>>();
let taskRecordsCache: ReviewTaskRecord[] | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function normalizeComparableClaim(claim: string): string {
  return claim.trim().replace(/\s+/g, " ").toLowerCase();
}

function isReviewTaskRecord(value: unknown): value is ReviewTaskRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as ReviewTaskRecord).draftId === "string" &&
      typeof (value as ReviewTaskRecord).claim === "string" &&
      typeof (value as ReviewTaskRecord).status === "string" &&
      typeof (value as ReviewTaskRecord).previewStatus === "string" &&
      typeof (value as ReviewTaskRecord).currentStage === "string" &&
      typeof (value as ReviewTaskRecord).startedAt === "string" &&
      typeof (value as ReviewTaskRecord).notificationSent === "boolean",
  );
}

function normalizeReviewTaskRecord(record: ReviewTaskRecord): ReviewTaskRecord {
  const storedClientRequestId = (record as { clientRequestId?: unknown })
    .clientRequestId;

  return {
    ...record,
    clientRequestId:
      typeof storedClientRequestId === "string"
        ? storedClientRequestId
        : record.draftId.startsWith("pending:")
          ? record.draftId
          : null,
  };
}

function readTaskRecords(): ReviewTaskRecord[] {
  if (taskRecordsCache) {
    return taskRecordsCache;
  }

  if (!canUseStorage()) {
    taskRecordsCache = [];
    return taskRecordsCache;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    taskRecordsCache = [];
    return taskRecordsCache;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      taskRecordsCache = [];
      return taskRecordsCache;
    }

    taskRecordsCache = parsed
      .filter(isReviewTaskRecord)
      .map(normalizeReviewTaskRecord);
    return taskRecordsCache;
  } catch {
    taskRecordsCache = [];
    return taskRecordsCache;
  }
}

function writeTaskRecords(records: ReviewTaskRecord[]): void {
  taskRecordsCache = records.slice(0, MAX_TASKS);

  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(taskRecordsCache));
  emitChange();
}

function updateTaskRecord(
  draftId: string,
  updater: (record: ReviewTaskRecord) => ReviewTaskRecord,
): ReviewTaskRecord | null {
  const records = readTaskRecords();
  let nextRecord: ReviewTaskRecord | null = null;

  writeTaskRecords(
    records.map((record) => {
      if (record.draftId !== draftId) {
        return record;
      }

      nextRecord = updater(record);
      return nextRecord;
    }),
  );

  return nextRecord;
}

function formatCreatedAtLabel(createdAt: string): string {
  const parsed = new Date(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return "방금 전";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function toTaskSummary(record: ReviewTaskRecord): ReviewPreviewSummary {
  const currentStageLabel = getReviewStageLabel(record.currentStage);
  const summaryStatus = record.previewStatus;
  const createdAt = record.reviewCreatedAt ?? record.startedAt;

  return {
    reviewId: record.reviewId ?? record.draftId,
    clientRequestId: record.clientRequestId ?? record.draftId,
    claim: record.claim,
    createdAt,
    createdAtLabel: formatCreatedAtLabel(createdAt),
    status: summaryStatus,
    statusLabel: getReviewStatusLabel(summaryStatus),
    currentStage: record.currentStage,
    currentStageLabel,
    selectedSourceCount: record.selectedSourceCount,
    lastErrorCode: record.lastErrorCode,
    subtitle:
      summaryStatus === "failed"
        ? "요청 실패"
        : record.selectedSourceCount > 0
          ? `선별 근거 ${record.selectedSourceCount}건`
          : currentStageLabel,
  };
}

function isActiveLocalTask(record: ReviewTaskRecord): boolean {
  return (
    !record.reviewId &&
    (record.status === "pending" || record.status === "submitting")
  );
}

function dedupeActiveLocalTasks(records: ReviewTaskRecord[]): ReviewTaskRecord[] {
  const seenActiveClaims = new Set<string>();

  return records.filter((record) => {
    if (!isActiveLocalTask(record)) {
      return true;
    }

    const normalizedClaim = normalizeComparableClaim(record.claim);

    if (!normalizedClaim) {
      return true;
    }

    if (seenActiveClaims.has(normalizedClaim)) {
      return false;
    }

    seenActiveClaims.add(normalizedClaim);
    return true;
  });
}

function toStartedTask(record: ReviewTaskRecord): ReviewTaskRecord {
  const now = new Date().toISOString();

  return {
    ...record,
    clientRequestId: record.clientRequestId ?? record.draftId,
    status: "submitting",
    previewStatus: "searching",
    currentStage: "query_refinement",
    startedAt: now,
    completedAt: null,
    reviewId: null,
    reviewCreatedAt: null,
    selectedSourceCount: 0,
    lastErrorCode: null,
    errorMessage: null,
    notificationSent: false,
  };
}

function toSucceededTask(
  record: ReviewTaskRecord,
  review: ReviewPreviewDetail,
): ReviewTaskRecord {
  return {
    ...record,
    clientRequestId: review.clientRequestId ?? record.clientRequestId ?? record.draftId,
    status: "succeeded",
    previewStatus: review.status,
    currentStage: review.currentStage,
    completedAt: new Date().toISOString(),
    reviewId: review.reviewId,
    reviewCreatedAt: review.createdAt,
    selectedSourceCount: review.selectedSourceCount,
    lastErrorCode: null,
    errorMessage: null,
  };
}

function toStoredFailedTask(
  record: ReviewTaskRecord,
  review: ReviewPreviewDetail,
): ReviewTaskRecord {
  return {
    ...record,
    clientRequestId: review.clientRequestId ?? record.clientRequestId ?? record.draftId,
    status: "failed",
    previewStatus: review.status,
    currentStage: review.currentStage,
    completedAt: new Date().toISOString(),
    reviewId: review.reviewId,
    reviewCreatedAt: review.createdAt,
    selectedSourceCount: review.selectedSourceCount,
    lastErrorCode: null,
    errorMessage: "근거 수집에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    notificationSent: false,
  };
}

function toFailedTask(
  record: ReviewTaskRecord,
  errorMessage: string,
): ReviewTaskRecord {
  return {
    ...record,
    clientRequestId: record.clientRequestId ?? record.draftId,
    status: "failed",
    previewStatus: "failed",
    currentStage: "failed",
    completedAt: new Date().toISOString(),
    reviewId: null,
    reviewCreatedAt: null,
    selectedSourceCount: 0,
    lastErrorCode: "CLIENT_SUBMIT_FAILED",
    errorMessage,
    notificationSent: false,
  };
}

function maybeCreateCompletionNotification(
  record: ReviewTaskRecord,
  review: ReviewPreviewDetail,
): void {
  if (record.notificationSent || !record.reviewId) {
    return;
  }

  createReviewCompletionNotification(review);

  updateTaskRecord(record.draftId, (currentRecord) => ({
    ...currentRecord,
    notificationSent: true,
  }));
}

export function createReviewTask(claim: string): string {
  const normalizedClaim = normalizeComparableClaim(claim);
  const records = readTaskRecords();
  const existingActiveTask = getReviewTasks().find(
    (record) =>
      isActiveLocalTask(record) &&
      normalizeComparableClaim(record.claim) === normalizedClaim,
  );

  if (existingActiveTask) {
    return existingActiveTask.draftId;
  }

  const draftId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `pending:${crypto.randomUUID()}`
      : `pending:${Date.now()}`;
  const now = new Date().toISOString();

  writeTaskRecords([
    {
      draftId,
      clientRequestId: draftId,
      claim,
      status: "pending",
      previewStatus: "searching",
      currentStage: "query_refinement",
      startedAt: now,
      completedAt: null,
      reviewId: null,
      reviewCreatedAt: null,
      selectedSourceCount: 0,
      lastErrorCode: null,
      errorMessage: null,
      notificationSent: false,
    },
    ...records,
  ]);

  return draftId;
}

export function getReviewTask(draftId: string): ReviewTaskRecord | null {
  return readTaskRecords().find((record) => record.draftId === draftId) ?? null;
}

export function getReviewTasks(): ReviewTaskRecord[] {
  return readTaskRecords().sort(
    (left, right) =>
      new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
}

export function getReviewTaskSummaries(): ReviewPreviewSummary[] {
  return dedupeActiveLocalTasks(getReviewTasks()).map(toTaskSummary);
}

export function getActiveReviewTask(): ReviewTaskRecord | null {
  const activeRecords = getReviewTasks().filter(isActiveLocalTask);

  return activeRecords[0] ?? null;
}

export function patchReviewTask(
  draftId: string,
  updates: Partial<
    Pick<
      ReviewTaskRecord,
      | "previewStatus"
      | "currentStage"
      | "selectedSourceCount"
      | "lastErrorCode"
      | "errorMessage"
      | "status"
    >
  >,
): void {
  updateTaskRecord(draftId, (record) => ({
    ...record,
    ...updates,
  }));
}

export function removeReviewTask(draftId: string): void {
  writeTaskRecords(
    readTaskRecords().filter((record) => record.draftId !== draftId),
  );
}

export function subscribeReviewTasks(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

export function startReviewTask(draftId: string): Promise<void> {
  const existingRequest = inFlightRequests.get(draftId);

  if (existingRequest) {
    return existingRequest;
  }

  const task = getReviewTask(draftId);

  if (!task) {
    return Promise.reject(new Error("review task를 찾을 수 없습니다."));
  }

  if (task.status === "succeeded" && task.reviewId) {
    return Promise.resolve();
  }

  updateTaskRecord(draftId, toStartedTask);

  const request = (async () => {
    try {
      const review = await api.reviews.create(task.claim, draftId);
      if (review.status === "failed") {
        updateTaskRecord(draftId, (currentRecord) =>
          toStoredFailedTask(currentRecord, review),
        );

        return;
      }

      const succeededTask = updateTaskRecord(draftId, (currentRecord) =>
        toSucceededTask(currentRecord, review),
      );

      if (succeededTask) {
        maybeCreateCompletionNotification(succeededTask, review);
      }
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError
          ? error.message
          : "리뷰 preview 생성에 실패했습니다.";

      updateTaskRecord(draftId, (currentRecord) =>
        toFailedTask(currentRecord, errorMessage),
      );

      throw error;
    } finally {
      inFlightRequests.delete(draftId);
    }
  })();

  inFlightRequests.set(draftId, request);

  return request;
}
