"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import { refreshNotifications } from "@/lib/notifications/store";
import { AnswerHistoryList } from "@/components/answers/AnswerHistoryList";
import { AnswerPreviewSummary } from "@/lib/answers/types";
import { getMergedAnswerSummaries } from "@/lib/answers/history";
import {
  removeAnswerTask,
  removeAnswerTaskByAnswerId,
  subscribeAnswerTasks,
} from "@/lib/answers/task-store";

export default function HistoryPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerPreviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingAnswerId, setDeletingAnswerId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getMergedAnswerSummaries(api.answers.getRecent)
      .then((result) => {
        if (active) {
          setAnswers(result);
          setErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof ApiClientError
              ? error.message
              : "히스토리를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeAnswerTasks(() => {
      void getMergedAnswerSummaries(api.answers.getRecent)
        .then((result) => {
          if (active) {
            setAnswers(result);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleDeleteAnswer = async (answer: AnswerPreviewSummary) => {
    const isPendingAnswer = answer.answerId.startsWith("pending:");
    const confirmMessage = isPendingAnswer
      ? "이 임시 answer 기록을 삭제하시겠습니까?"
      : "이 answer를 삭제하시겠습니까?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingAnswerId(answer.answerId);

    try {
      if (isPendingAnswer) {
        removeAnswerTask(answer.answerId);
      } else {
        await api.answers.delete(answer.answerId);
        removeAnswerTaskByAnswerId(answer.answerId);
        void refreshNotifications().catch(() => undefined);
      }

      setAnswers((currentAnswers) =>
        currentAnswers.filter((item) => item.answerId !== answer.answerId),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "answer를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingAnswerId(null);
    }
  };

  return (
    <div className="min-h-full bg-[#faf8ff] px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-[#424656] transition-colors hover:bg-[#e6e7f4]"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#191b24]">
              History
            </h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              최근 검토한 answer preview를 다시 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-[#ffd7d7] bg-[#fff6f6] px-4 py-3 text-sm text-[#b42318]">
            {errorMessage}
          </div>
        ) : null}

        <AnswerHistoryList
          answers={answers}
          isLoading={isLoading}
          emptyMessage="아직 생성된 answer 기록이 없습니다."
          onDelete={handleDeleteAnswer}
          deletingAnswerId={deletingAnswerId}
        />
      </div>
    </div>
  );
}
