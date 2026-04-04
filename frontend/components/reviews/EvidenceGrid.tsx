interface EvidenceGridProps {
  searchedSourceCount: number;
  selectedSourceCount: number;
  discardedSourceCount: number;
  coreClaim: string;
  normalizedClaim: string;
  topicScopeLabel: string;
  topicCountryCode: string | null;
  countryDetectionReason: string;
  pendingMessage: string;
  createdAtLabel: string;
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
  normalizedClaim,
  topicScopeLabel,
  topicCountryCode,
  countryDetectionReason,
  pendingMessage,
  createdAtLabel,
  generatedQueries,
}: EvidenceGridProps) {
  const coverage =
    searchedSourceCount > 0
      ? Math.max(6, Math.round((selectedSourceCount / searchedSourceCount) * 100))
      : 0;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-[0_22px_45px_rgba(12,23,43,0.08)] ring-1 ring-[#dbe2ee]/70 backdrop-blur-md">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f0ff] text-[#0050cb]">
              <span className="material-symbols-outlined">fact_check</span>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#0050cb]">
              Preview Status
            </span>
          </div>

          <p className="text-sm leading-6 text-[#2b3240] sm:text-[15px]">
            {pendingMessage}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[#8a94a6]">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined !text-[16px]">update</span>
              {createdAtLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined !text-[16px]">language</span>
              {topicScopeLabel}
              {topicCountryCode ? ` · ${topicCountryCode}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[28px] bg-[linear-gradient(160deg,#0e63ff_0%,#0050cb_62%,#0d3d94_100%)] p-6 text-white shadow-[0_22px_45px_rgba(0,80,203,0.28)]">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-white/78">
              Evidence Coverage
            </h3>
            <div className="mt-5 text-5xl font-black tracking-[-0.05em]">
              {selectedSourceCount}
            </div>
            <p className="mt-2 text-xs leading-5 text-white/76">
              검색 후보 {searchedSourceCount}건 중 선별된 근거 수입니다. 제외 후보는 {discardedSourceCount}건입니다.
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/76">
              <span>Selected / Searched</span>
              <span>{searchedSourceCount > 0 ? `${coverage}%` : "0%"}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${coverage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#e8ecf4] bg-white p-6 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#0050cb]">
              Query Context
            </p>
            <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#191b24]">
              {coreClaim}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              정규화 claim: <span className="font-medium text-[#191b24]">{normalizedClaim}</span>
            </p>
          </div>
          <div className="rounded-full bg-[#f3f6fb] px-3 py-1.5 text-xs font-bold text-[#556070]">
            {topicScopeLabel}
            {topicCountryCode ? ` · ${topicCountryCode}` : ""}
          </div>
        </div>

        <p className="mt-4 rounded-2xl bg-[#f7f9fc] px-4 py-3 text-sm leading-6 text-[#556070]">
          {countryDetectionReason}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#eff5ff] px-3 py-1.5 text-xs font-semibold text-[#0050cb]">
            검색 후보 {searchedSourceCount}건
          </span>
          <span className="rounded-full bg-[#eff5ff] px-3 py-1.5 text-xs font-semibold text-[#0050cb]">
            선별 근거 {selectedSourceCount}건
          </span>
          <span className="rounded-full bg-[#f6f7fb] px-3 py-1.5 text-xs font-semibold text-[#556070]">
            제외 후보 {discardedSourceCount}건
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {generatedQueries.length > 0 ? (
            generatedQueries.map((query) => (
              <span
                key={query.id}
                className="rounded-full border border-[#dce8ff] bg-[#fbfdff] px-3 py-1.5 text-xs font-medium text-[#334155]"
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
