import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import { refreshNotifications } from "@/lib/notifications/store";
import {
  getAnswerStageLabel,
  getAnswerStatusLabel,
} from "@/lib/answers/mappers";
import {
  AnswerPreviewDetail,
  AnswerPreviewSummary,
  AnswerTaskRecord,
} from "@/lib/answers/types";

const STORAGE_KEY = "varo.answer-tasks";
const CHANGE_EVENT = "varo-answer-tasks-changed";
const MAX_TASKS = 20;

const inFlightRequests = new Map<string, Promise<void>>();
let taskRecordsCache: AnswerTaskRecord[] | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function normalizeComparableCheck(check: string): string {
  return check.trim().replace(/\s+/g, " ").toLowerCase();
}

function isAnswerTaskRecord(value: unknown): value is AnswerTaskRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as AnswerTaskRecord).draftId === "string" &&
      typeof (value as AnswerTaskRecord).check === "string" &&
      typeof (value as AnswerTaskRecord).status === "string" &&
      typeof (value as AnswerTaskRecord).previewStatus === "string" &&
      typeof (value as AnswerTaskRecord).currentStage === "string" &&
      typeof (value as AnswerTaskRecord).startedAt === "string" &&
      typeof (value as AnswerTaskRecord).notificationSent === "boolean",
  );
}

function normalizeAnswerTaskRecord(record: AnswerTaskRecord): AnswerTaskRecord {
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

function readTaskRecords(): AnswerTaskRecord[] {
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
      .filter(isAnswerTaskRecord)
      .map(normalizeAnswerTaskRecord);
    return taskRecordsCache;
  } catch {
    taskRecordsCache = [];
    return taskRecordsCache;
  }
}

function writeTaskRecords(records: AnswerTaskRecord[]): void {
  taskRecordsCache = records.slice(0, MAX_TASKS);

  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(taskRecordsCache));
  emitChange();
}

function updateTaskRecord(
  draftId: string,
  updater: (record: AnswerTaskRecord) => AnswerTaskRecord,
): AnswerTaskRecord | null {
  const records = readTaskRecords();
  let nextRecord: AnswerTaskRecord | null = null;

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

function toTaskSummary(record: AnswerTaskRecord): AnswerPreviewSummary {
  const currentStageLabel = getAnswerStageLabel(record.currentStage);
  const summaryStatus = record.previewStatus;
  const createdAt = record.answerCreatedAt ?? record.startedAt;

  return {
    answerId: record.answerId ?? record.draftId,
    clientRequestId: record.clientRequestId ?? record.draftId,
    check: record.check,
    createdAt,
    createdAtLabel: formatCreatedAtLabel(createdAt),
    status: summaryStatus,
    statusLabel: getAnswerStatusLabel(summaryStatus),
    currentStage: record.currentStage,
    currentStageLabel,
    selectedSourceCount: record.selectedSourceCount,
    lastErrorCode: record.lastErrorCode,
    subtitle:
      summaryStatus === "out_of_scope"
        ? "지원 범위 밖"
        : summaryStatus === "failed"
        ? "요청 실패"
        : record.selectedSourceCount > 0
          ? `선별 근거 ${record.selectedSourceCount}건`
          : currentStageLabel,
  };
}

function isActiveLocalTask(record: AnswerTaskRecord): boolean {
  return (
    !record.answerId &&
    (record.status === "pending" || record.status === "submitting")
  );
}

function dedupeActiveLocalTasks(records: AnswerTaskRecord[]): AnswerTaskRecord[] {
  const seenActiveChecks = new Set<string>();

  return records.filter((record) => {
    if (!isActiveLocalTask(record)) {
      return true;
    }

    const normalizedCheck = normalizeComparableCheck(record.check);

    if (!normalizedCheck) {
      return true;
    }

    if (seenActiveChecks.has(normalizedCheck)) {
      return false;
    }

    seenActiveChecks.add(normalizedCheck);
    return true;
  });
}

function toStartedTask(record: AnswerTaskRecord): AnswerTaskRecord {
  const now = new Date().toISOString();

  return {
    ...record,
    clientRequestId: record.clientRequestId ?? record.draftId,
    status: "submitting",
    previewStatus: "searching",
    currentStage: "query_refinement",
    startedAt: now,
    completedAt: null,
    answerId: null,
    answerCreatedAt: null,
    selectedSourceCount: 0,
    lastErrorCode: null,
    errorMessage: null,
    notificationSent: false,
  };
}

function toSucceededTask(
  record: AnswerTaskRecord,
  answer: AnswerPreviewDetail,
): AnswerTaskRecord {
  return {
    ...record,
    clientRequestId: answer.clientRequestId ?? record.clientRequestId ?? record.draftId,
    status: "succeeded",
    previewStatus: answer.status,
    currentStage: answer.currentStage,
    completedAt: new Date().toISOString(),
    answerId: answer.answerId,
    answerCreatedAt: answer.createdAt,
    selectedSourceCount: answer.selectedSourceCount,
    lastErrorCode: null,
    errorMessage: null,
  };
}

function toProcessingTask(
  record: AnswerTaskRecord,
  answer: AnswerPreviewDetail,
): AnswerTaskRecord {
  return {
    ...record,
    clientRequestId: answer.clientRequestId ?? record.clientRequestId ?? record.draftId,
    status: "processing",
    previewStatus: answer.status,
    currentStage: answer.currentStage,
    completedAt: null,
    answerId: answer.answerId,
    answerCreatedAt: answer.createdAt,
    selectedSourceCount: answer.selectedSourceCount,
    lastErrorCode: null,
    errorMessage: null,
  };
}

function toStoredFailedTask(
  record: AnswerTaskRecord,
  answer: AnswerPreviewDetail,
): AnswerTaskRecord {
  return {
    ...record,
    clientRequestId: answer.clientRequestId ?? record.clientRequestId ?? record.draftId,
    status: "failed",
    previewStatus: answer.status,
    currentStage: answer.currentStage,
    completedAt: new Date().toISOString(),
    answerId: answer.answerId,
    answerCreatedAt: answer.createdAt,
    selectedSourceCount: answer.selectedSourceCount,
    lastErrorCode: null,
    errorMessage: "근거 수집에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    notificationSent: false,
  };
}

function toFailedTask(
  record: AnswerTaskRecord,
  errorMessage: string,
): AnswerTaskRecord {
  return {
    ...record,
    clientRequestId: record.clientRequestId ?? record.draftId,
    status: "failed",
    previewStatus: "failed",
    currentStage: "failed",
    completedAt: new Date().toISOString(),
    answerId: null,
    answerCreatedAt: null,
    selectedSourceCount: 0,
    lastErrorCode: "CLIENT_SUBMIT_FAILED",
    errorMessage,
    notificationSent: false,
  };
}

export function createAnswerTask(check: string): string {
  const normalizedCheck = normalizeComparableCheck(check);
  const records = readTaskRecords();
  const existingActiveTask = getAnswerTasks().find(
    (record) =>
      isActiveLocalTask(record) &&
      normalizeComparableCheck(record.check) === normalizedCheck,
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
      check,
      status: "pending",
      previewStatus: "searching",
      currentStage: "query_refinement",
      startedAt: now,
      completedAt: null,
      answerId: null,
      answerCreatedAt: null,
      selectedSourceCount: 0,
      lastErrorCode: null,
      errorMessage: null,
      notificationSent: false,
    },
    ...records,
  ]);

  return draftId;
}

export function getAnswerTask(draftId: string): AnswerTaskRecord | null {
  return readTaskRecords().find((record) => record.draftId === draftId) ?? null;
}

export function getAnswerTasks(): AnswerTaskRecord[] {
  return readTaskRecords().sort(
    (left, right) =>
      new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
}

export function getAnswerTaskSummaries(): AnswerPreviewSummary[] {
  return dedupeActiveLocalTasks(getAnswerTasks()).map(toTaskSummary);
}

export function getActiveAnswerTask(): AnswerTaskRecord | null {
  const activeRecords = getAnswerTasks().filter(isActiveLocalTask);

  return activeRecords[0] ?? null;
}

export function patchAnswerTask(
  draftId: string,
  updates: Partial<
    Pick<
      AnswerTaskRecord,
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

export function patchAnswerTaskByAnswerId(
  answerId: string,
  updates: Partial<
    Pick<
      AnswerTaskRecord,
      | "previewStatus"
      | "currentStage"
      | "selectedSourceCount"
      | "lastErrorCode"
      | "errorMessage"
      | "status"
      | "completedAt"
    >
  >,
): void {
  writeTaskRecords(
    readTaskRecords().map((record) =>
      record.answerId === answerId
        ? {
            ...record,
            ...updates,
          }
        : record,
    ),
  );
}

export function removeAnswerTask(draftId: string): void {
  writeTaskRecords(
    readTaskRecords().filter((record) => record.draftId !== draftId),
  );
}

export function removeAnswerTaskByAnswerId(answerId: string): void {
  writeTaskRecords(
    readTaskRecords().filter((record) => record.answerId !== answerId),
  );
}

export function clearAnswerTasks(): void {
  inFlightRequests.clear();
  writeTaskRecords([]);
}

export function subscribeAnswerTasks(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

export function startAnswerTask(draftId: string): Promise<void> {
  const existingRequest = inFlightRequests.get(draftId);

  if (existingRequest) {
    return existingRequest;
  }

  const task = getAnswerTask(draftId);

  if (!task) {
    return Promise.reject(new Error("answer task를 찾을 수 없습니다."));
  }

  if (task.status === "succeeded" && task.answerId) {
    return Promise.resolve();
  }

  updateTaskRecord(draftId, toStartedTask);

  const request = (async () => {
    try {
      const answer = await api.answers.create(task.check, draftId);

      if (answer.status === "failed") {
        updateTaskRecord(draftId, (currentRecord) =>
          toStoredFailedTask(currentRecord, answer),
        );

        return;
      }

      if (answer.status === "searching") {
        updateTaskRecord(draftId, (currentRecord) =>
          toProcessingTask(currentRecord, answer),
        );

        return;
      }

      const succeededTask = updateTaskRecord(draftId, (currentRecord) =>
        toSucceededTask(currentRecord, answer),
      );

      if (succeededTask) {
        void refreshNotifications().catch(() => undefined);
      }
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError
          ? error.message
          : "answer preview 생성에 실패했습니다.";

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
