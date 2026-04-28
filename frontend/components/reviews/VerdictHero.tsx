interface VerdictHeroProps {
  claim: string;
  verdictLabel: string;
  confidenceScore: number;
  createdAtLabel: string;
  currentStageLabel: string;
  pendingMessage: string;
}

/**
 * review preview 헤더 컴포넌트
 */
export default function VerdictHero({
  claim,
  verdictLabel,
  confidenceScore,
  createdAtLabel,
  currentStageLabel,
  pendingMessage,
}: VerdictHeroProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#dfe4f0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#0050cb]">
            임시 분석 결과
          </span>
          <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-[#0050cb]">
            {currentStageLabel}
          </span>
        </div>

        <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.04em] text-[#191b24] sm:text-[2.2rem]">
          {claim}
        </h1>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0050cb_0%,#0066ff_100%)] text-white">
            <span className="material-symbols-outlined">verified</span>
          </div>
          <div>
            <p className="text-xl font-bold text-[#0050cb]">{verdictLabel}</p>
            <p className="text-sm text-[#6b7280]">VARO 검토 안정도 {confidenceScore}%</p>
          </div>
        </div>
      </div>

      <p className="text-sm leading-6 text-[#6b7280]">{pendingMessage}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-[#6b7280]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-[#d8deeb]">
          <span className="material-symbols-outlined !text-[18px] text-[#0050cb]">schedule</span>
          {createdAtLabel}
        </span>
      </div>
    </section>
  );
}
