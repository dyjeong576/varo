interface EvidenceGridProps {
  searchedSourceCount: number;
  selectedSourceCount: number;
  discardedSourceCount: number;
  coreClaim: string;
  topicScopeLabel: string;
  topicCountryCode: string | null;
  generatedQueries: { id: string; text: string; rank: number }[];
}

/**
 * review preview 요약 카드 컴포넌트
 */
export default function EvidenceGrid({
  searchedSourceCount,
  selectedSourceCount,
  discardedSourceCount,
  coreClaim,
  topicScopeLabel,
  topicCountryCode,
  generatedQueries,
}: EvidenceGridProps) {
  const summaryCards = [
    { label: "검색 후보", value: searchedSourceCount },
    { label: "선별 근거", value: selectedSourceCount },
    { label: "제외 후보", value: discardedSourceCount },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white p-4 rounded-xl border border-[#c2c6d8]/15 shadow-sm"
          >
            <p className="text-[11px] font-bold text-[#424656]">{card.label}</p>
            <p className="mt-3 text-2xl font-black text-[#191b24]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 rounded-xl border border-[#c2c6d8]/15 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#0050cb]">
              질의 처리 메타데이터
            </p>
            <h3 className="mt-2 text-lg font-bold text-[#191b24]">{coreClaim}</h3>
          </div>
          <div className="rounded-full bg-[#f2f3ff] px-3 py-1 text-xs font-bold text-[#424656]">
            {topicScopeLabel}
            {topicCountryCode ? ` · ${topicCountryCode}` : ""}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {generatedQueries.length > 0 ? (
            generatedQueries.map((query) => (
              <span
                key={query.id}
                className="rounded-full border border-[#d6e3fb] bg-[#f8fbff] px-3 py-1.5 text-xs font-medium text-[#424656]"
              >
                Q{query.rank}. {query.text}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#6b7280]">
              생성된 query가 아직 없습니다.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
