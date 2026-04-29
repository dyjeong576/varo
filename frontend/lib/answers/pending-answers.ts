import { AnswerPreviewSummary } from "@/lib/answers/types";
import {
  createAnswerTask,
  getAnswerTaskSummaries,
  patchAnswerTask,
  removeAnswerTask,
  subscribeAnswerTasks,
} from "@/lib/answers/task-store";

export function createPendingAnswerDraft(check: string): string {
  return createAnswerTask(check);
}

export function updatePendingAnswerDraft(
  draftId: string,
  updates: {
    status?: string;
    currentStage?: string;
    selectedSourceCount?: number;
    lastErrorCode?: string | null;
  },
): void {
  patchAnswerTask(draftId, {
    previewStatus: updates.status,
    currentStage: updates.currentStage,
    selectedSourceCount: updates.selectedSourceCount,
    lastErrorCode: updates.lastErrorCode,
    status: updates.status === "failed" ? "failed" : undefined,
  });
}

export function removePendingAnswerDraft(draftId: string): void {
  removeAnswerTask(draftId);
}

export function getPendingAnswerSummaries(): AnswerPreviewSummary[] {
  return getAnswerTaskSummaries().filter((summary) =>
    summary.answerId.startsWith("pending:"),
  );
}

export function subscribePendingAnswerSummaries(
  callback: () => void,
): () => void {
  return subscribeAnswerTasks(callback);
}
