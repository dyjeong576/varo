import { ReviewPreviewSummary } from "@/lib/reviews/types";
import {
  createReviewTask,
  getReviewTaskSummaries,
  patchReviewTask,
  removeReviewTask,
  subscribeReviewTasks,
} from "@/lib/reviews/task-store";

export function createPendingReviewDraft(claim: string): string {
  return createReviewTask(claim);
}

export function updatePendingReviewDraft(
  draftId: string,
  updates: {
    status?: string;
    currentStage?: string;
    selectedSourceCount?: number;
    lastErrorCode?: string | null;
  },
): void {
  patchReviewTask(draftId, {
    previewStatus: updates.status,
    currentStage: updates.currentStage,
    selectedSourceCount: updates.selectedSourceCount,
    lastErrorCode: updates.lastErrorCode,
    status: updates.status === "failed" ? "failed" : undefined,
  });
}

export function removePendingReviewDraft(draftId: string): void {
  removeReviewTask(draftId);
}

export function getPendingReviewSummaries(): ReviewPreviewSummary[] {
  return getReviewTaskSummaries().filter((summary) =>
    summary.reviewId.startsWith("pending:"),
  );
}

export function subscribePendingReviewSummaries(
  callback: () => void,
): () => void {
  return subscribeReviewTasks(callback);
}
