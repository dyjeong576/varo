interface AnalysisSummaryProps {
  interpretation: string;
  mode: string;
  officialSourceCount: number;
  sourceCount: number;
  evidenceSnippetCount: number;
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
}: AnalysisSummaryProps) {
  const hasOfficialSource = officialSourceCount > 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h3 className="text-lg font-bold tracking-tight text-[#191b24]">
          수집 뉴스 종합 요약
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            hasOfficialSource
              ? "bg-[#eef5ff] text-[#0050cb]"
              : "bg-[#f6f7fb] text-[#556070]"
          }`}
        >
          {hasOfficialSource
            ? "공식 발표/공식 출처 확인됨"
            : "공식 발표/공식 출처는 아직 확인되지 않음"}
        </span>
      </div>
      <div className="rounded-xl border-l-4 border-[#0050cb] bg-[#b3c5ff]/10 p-5">
        <p className="mb-3 text-xs font-semibold text-[#6b7280]">
          수집된 출처 기준 · 출처 {sourceCount}건 · 근거 {evidenceSnippetCount}건
        </p>
        <p className="text-[#191b24] leading-relaxed text-sm whitespace-pre-wrap">
          {interpretation}
        </p>
        <p className="mt-3 text-xs text-[#6b7280]">
          {mode === "rule_based_preview"
            ? "현재 단계에서는 저장된 근거만으로 계산한 임시 요약입니다."
            : ""}
        </p>
      </div>
    </section>
  );
}
