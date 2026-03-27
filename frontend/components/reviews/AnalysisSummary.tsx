interface AnalysisSummaryProps {
  interpretation: string;
}

/**
 * AI 심층 분석 요약 섹션 컴포넌트
 */
export default function AnalysisSummary({ interpretation }: AnalysisSummaryProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold text-[#191b24] px-1 tracking-tight">
        AI 심층 분석 요약
      </h3>
      <div className="bg-[#b3c5ff]/10 p-5 rounded-xl border-l-4 border-[#0050cb]">
        <p className="text-[#191b24] leading-relaxed text-sm whitespace-pre-wrap">
          {// 마크다운 형태의 **강조** 처리를 간단히 지원하거나 원문 그대로 출력
            interpretation
          }
        </p>
      </div>
    </section>
  );
}
