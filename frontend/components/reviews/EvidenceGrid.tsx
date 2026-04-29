import { InfoTooltip } from "@/components/ui/info-tooltip";

interface EvidenceGridProps {
  searchedSourceCount: number;
  selectedSourceCount: number;
  agreementCount: number;
  conflictCount: number;
  contextCount: number;
  consensusLabel: string;
  sourceBreakdown: {
    official: number;
    press: number;
    social: number;
    analysis: number;
    other: number;
  };
}

interface QueryContextDisclosureProps {
  searchedSourceCount: number;
  selectedSourceCount: number;
  discardedSourceCount: number;
  coreClaim: string;
  normalizedClaim: string;
  generatedQueries: { id: string; text: string; rank: number }[];
}

/**
 * review preview 요약 카드 컴포넌트
 */
export default function EvidenceGrid({
  agreementCount,
  conflictCount,
  contextCount,
  consensusLabel,
  sourceBreakdown,
}: EvidenceGridProps) {
  const stanceCount = agreementCount + conflictCount;
  const agreementPosition =
    stanceCount > 0
      ? Math.max(4, Math.min(96, Math.round((agreementCount / stanceCount) * 100)))
      : 50;
  const sourceEntries = [
    { label: "공식", value: sourceBreakdown.official, tone: "bg-[#0050cb]" },
    { label: "언론", value: sourceBreakdown.press, tone: "bg-[#d6e3fb]" },
    { label: "소셜", value: sourceBreakdown.social, tone: "bg-[#c2c6d8]" },
  ];
  const maxSourceValue = Math.max(...sourceEntries.map((entry) => entry.value), 1);

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-[#eef3ff] p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#556070]">
          <span className="material-symbols-outlined text-sm">analytics</span>
          교차 검증 일치도
          <InfoTooltip content="수집된 뉴스 기사들이 이 주장에 얼마나 동의하는지를 보여줍니다. 지지 기사가 많을수록 오른쪽(사실), 반박 기사가 많을수록 왼쪽(거짓)에 가깝게 표시됩니다." />
        </h3>
        <div className="mb-2 h-3 w-full rounded-full bg-[linear-gradient(90deg,#cc4204_0%,#0066ff_100%)]">
          <div
            className="relative h-full"
            style={{ width: `${agreementPosition}%` }}
          >
            <div className="absolute right-0 top-1/2 h-5 w-3 -translate-y-1/2 rounded-full border-2 border-[#0050cb] bg-white shadow-sm" />
          </div>
        </div>
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight text-[#6b7280]">
          <span>거짓</span>
          <span>불분명</span>
          <span>사실</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex h-40 flex-col justify-between rounded-xl border border-[#dfe4f0] bg-white p-5">
          <p className="text-xs font-bold text-[#6b7280]">출처 분포</p>
          <div className="flex h-16 items-end gap-2">
            {sourceEntries.map((entry) => (
              <div
                key={entry.label}
                className={`flex-1 rounded-t-sm ${entry.tone}`}
                style={{
                  height: `${entry.value > 0 ? Math.max(18, (entry.value / maxSourceValue) * 100) : 12}%`,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-medium text-[#6b7280]">
            {sourceEntries.map((entry) => (
              <span key={entry.label}>{entry.label}</span>
            ))}
          </div>
        </div>

        <div className="flex h-40 flex-col justify-between rounded-xl border border-[#dfe4f0] bg-white p-5">
          <p className="flex items-center gap-1 text-xs font-bold text-[#6b7280]">
            정보 합의성
            <InfoTooltip content="수집된 기사들이 얼마나 일관되게 같은 결론을 가리키는지를 나타냅니다. '높음'은 2건 이상의 기사가 주장을 뒷받침할 때만 표시되며, '거짓' 판정 시에는 항상 '낮음'으로 표시됩니다." />
          </p>
          <div className="flex flex-1 flex-col items-center justify-center">
            <span className="text-3xl font-black text-[#0050cb]">{consensusLabel}</span>
            <span className="mt-1 text-center text-[10px] text-[#6b7280]">
              지지 {agreementCount} · 충돌 {conflictCount} · 맥락 {contextCount}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function QueryContextDisclosure({
  searchedSourceCount,
  selectedSourceCount,
  discardedSourceCount,
  coreClaim,
  normalizedClaim,
  generatedQueries,
}: QueryContextDisclosureProps) {
  return (
    <details className="group rounded-xl border border-[#dfe4f0] bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#0050cb]">
            Query Context
          </p>
          <p className="mt-1 text-sm font-semibold text-[#556070]">
            검색에 사용한 내부 맥락 보기
          </p>
        </div>
        <span className="material-symbols-outlined text-[#8a94a6] transition-transform group-open:rotate-180">
          expand_more
        </span>
      </summary>

      <div className="mt-5 border-t border-[#edf1f7] pt-5 space-y-4">
        <div>
          <h3 className="text-lg font-black tracking-[-0.03em] text-[#191b24]">
            {coreClaim}
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-[#8a94a6]">
            정규화: <span className="text-[#556070]">{normalizedClaim}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6b7280]">
          <span>
            검색 후보 <span className="font-semibold text-[#0050cb]">{searchedSourceCount}</span>건
          </span>
          <span className="text-[#d1d5db]">·</span>
          <span>
            선별 근거 <span className="font-semibold text-[#0050cb]">{selectedSourceCount}</span>건
          </span>
          <span className="text-[#d1d5db]">·</span>
          <span>
            제외 후보 <span className="font-semibold text-[#556070]">{discardedSourceCount}</span>건
          </span>
        </div>

        {generatedQueries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {generatedQueries.map((query) => (
              <span
                key={query.id}
                className="rounded-full border border-[#dce8ff] bg-[#fbfdff] px-3 py-1.5 text-xs font-medium text-[#334155]"
              >
                Q{query.rank}. {query.text}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#8a94a6]">생성된 query가 아직 없습니다.</p>
        )}
      </div>
    </details>
  );
}
