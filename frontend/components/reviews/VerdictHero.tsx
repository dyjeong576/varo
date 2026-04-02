interface VerdictHeroProps {
  claim: string;
  statusLabel: string;
  currentStageLabel: string;
  createdAtLabel: string;
  pendingMessage: string;
  statusTone: "blue" | "slate" | "red";
}

/**
 * review preview 헤더 컴포넌트
 */
export default function VerdictHero({
  claim,
  statusLabel,
  currentStageLabel,
  createdAtLabel,
  pendingMessage,
  statusTone,
}: VerdictHeroProps) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    slate: "bg-gray-100 text-gray-700 border-gray-200",
    red: "bg-red-50 text-red-600 border-red-100",
  };

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#c2c6d8]/15">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#0050cb]">
            Review Preview
          </span>
          <span className={`px-3 py-1 rounded-full border text-xs font-bold ${toneClassName[statusTone]}`}>
            {currentStageLabel}
          </span>
        </div>
        
        <h2 className="text-2xl font-extrabold text-[#191b24] leading-tight mb-2 tracking-tight">
          &quot;{claim}&quot;
        </h2>
        
        <div className="flex items-center gap-3 mt-6">
          <div className="h-12 w-12 bg-[#0050cb] rounded-full flex items-center justify-center text-white shrink-0 shadow-md">
            <span className="material-symbols-outlined !text-[24px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
              page_info
            </span>
          </div>
          <div>
            <p className="text-[#0050cb] font-bold text-xl leading-none mb-1">{statusLabel}</p>
            <p className="text-[#424656] text-sm">{createdAtLabel}</p>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-[#f2f3ff] px-4 py-3 text-sm leading-relaxed text-[#424656]">
          {pendingMessage}
        </p>
      </div>
    </section>
  );
}
