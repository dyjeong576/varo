interface AnalysisSummaryProps {
  interpretation: string;
  mode: string;
}

/**
 * AI 심층 분석 요약 섹션 컴포넌트
 */
export default function AnalysisSummary({ interpretation, mode }: AnalysisSummaryProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold text-[#191b24] px-1 tracking-tight">
        AI 심층 분석 요약
      </h3>
      <div className="rounded-xl border-l-4 border-[#0050cb] bg-[#b3c5ff]/10 p-5">
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
