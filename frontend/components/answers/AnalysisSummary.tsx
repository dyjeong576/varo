interface AnalysisSummaryProps {
  interpretation: string;
  mode: string;
  officialSourceCount: number;
  sourceCount: number;
  evidenceSnippetCount: number;
  isFactCheckQuestion: boolean;
}

/**
 * 수집 뉴스 종합 요약 섹션 컴포넌트
 */
export default function AnalysisSummary({
  interpretation,
  mode,
  officialSourceCount,
  sourceCount,
  evidenceSnippetCount,
  isFactCheckQuestion,
}: AnalysisSummaryProps) {
  const hasOfficialSource = officialSourceCount > 0;
  const badgeLabel = isFactCheckQuestion
    ? hasOfficialSource
      ? "공식 발표/공식 출처 확인됨"
      : "공식 발표/공식 출처는 아직 확인되지 않음"
    : "fact-check verdict 아님";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h3 className="text-lg font-bold tracking-tight text-[#191b24]">
          {isFactCheckQuestion ? "수집 뉴스 종합 요약" : "직접 답변"}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isFactCheckQuestion && hasOfficialSource
              ? "bg-[#eef5ff] text-[#0050cb]"
              : "bg-[#f6f7fb] text-[#556070]"
          }`}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="rounded-xl border-l-4 border-[#0050cb] bg-[#b3c5ff]/10 p-5">
        <p className="mb-3 text-xs font-semibold text-[#6b7280]">
          {isFactCheckQuestion
            ? `수집된 출처 기준 · 출처 ${sourceCount}건 · 근거 ${evidenceSnippetCount}건`
            : `Perplexity 직접 답변 · 인용 ${sourceCount}건`}
        </p>
        <p className="text-[#191b24] leading-relaxed text-sm whitespace-pre-wrap">
          {interpretation}
        </p>
        <p className="mt-3 text-xs text-[#6b7280]">
          {mode === "rule_based_preview"
            ? isFactCheckQuestion
              ? "현재 단계에서는 저장된 근거를 바탕으로 생성한 임시 요약입니다."
              : "출처 기반 사실성 검토 verdict가 아닌 직접 답변입니다."
            : ""}
        </p>
      </div>
    </section>
  );
}
