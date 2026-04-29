"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { AnswerPreviewSummary } from "@/lib/answers/types";
import { buildAnswerEntryHref } from "@/lib/answers/navigation";

interface AnswerHistoryListProps {
  answers: AnswerPreviewSummary[];
  isLoading?: boolean;
  emptyMessage?: string;
  onNavigate?: () => void;
  onDelete?: (answer: AnswerPreviewSummary) => void | Promise<void>;
  deletingAnswerId?: string | null;
}

export function AnswerHistoryList({
  answers,
  isLoading = false,
  emptyMessage = "데이터가 없습니다.",
  onNavigate,
  onDelete,
  deletingAnswerId = null,
}: AnswerHistoryListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (answers.length === 0) {
    return (
      <div className="text-center p-4 text-sm text-gray-400 font-medium">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {answers.map((answer) => {
        const badgeClassName =
          answer.status === "failed"
            ? "bg-red-50 text-red-600 border-red-100"
            : answer.status === "partial"
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : "bg-gray-100 text-gray-600 border-gray-200";

        const content = (
          <>
            <h4 className="text-[14px] font-bold text-gray-800 break-keep leading-[1.4]">
              {answer.check}
            </h4>
            <div
              className={`inline-flex mt-2 items-center px-2 py-1 rounded-md border text-[11px] font-bold tracking-tight ${badgeClassName}`}
            >
              {answer.currentStageLabel}
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              {answer.createdAtLabel} · {answer.subtitle}
            </p>
          </>
        );

        const contentNode = answer.answerId.startsWith("pending:")
          ? (
            <div className="min-w-0 flex-1">
              {content}
            </div>
          )
          : (
            <Link
              href={buildAnswerEntryHref(answer.answerId, "history")}
              className="min-w-0 flex-1"
              onClick={onNavigate}
            >
              {content}
            </Link>
          );

        return (
          <div
            key={answer.answerId}
            className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-blue-50/30"
          >
            {contentNode}
            {onDelete ? (
              <button
                type="button"
                aria-label="answer 삭제"
                disabled={deletingAnswerId === answer.answerId}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void onDelete(answer);
                }}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
