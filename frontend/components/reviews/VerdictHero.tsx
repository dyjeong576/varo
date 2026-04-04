interface VerdictHeroProps {
  reviewId: string;
  claim: string;
  coreClaim: string;
  statusLabel: string;
  currentStageLabel: string;
  createdAtLabel: string;
  statusTone: "blue" | "slate" | "red";
}

/**
 * review preview 헤더 컴포넌트
 */
export default function VerdictHero({
  reviewId,
  claim,
  coreClaim,
  statusLabel,
  currentStageLabel,
  createdAtLabel,
  statusTone,
}: VerdictHeroProps) {
  const toneClassName = {
    blue: "bg-[#fff4d6] text-[#b46a00]",
    slate: "bg-[#edf1f7] text-[#556070]",
    red: "bg-[#fde8e8] text-[#ba1a1a]",
  };
  const previewCaseLabel = `Preview #${reviewId.slice(0, 8).toUpperCase()}`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-[0.18em] ${toneClassName[statusTone]}`}
        >
          <span className="material-symbols-outlined !text-[14px]">error</span>
          {statusLabel}
        </span>
        <span className="text-sm font-medium text-[#98a1b2]">{previewCaseLabel}</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-[2rem] font-black tracking-[-0.04em] text-[#151821] sm:text-[2.35rem]">
          {claim}
        </h1>
        <p className="text-base text-[#6b7280] sm:text-lg">
          Core Claim:{" "}
          <span className="font-semibold text-[#191b24]">{coreClaim}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-[#6b7280]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-[#d8deeb] backdrop-blur-sm">
          <span className="material-symbols-outlined !text-[18px] text-[#0050cb]">
            auto_awesome
          </span>
          {currentStageLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined !text-[18px] text-[#9aa3b2]">
            schedule
          </span>
          {createdAtLabel}
        </span>
      </div>
    </section>
  );
}
