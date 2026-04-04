interface UncertaintyCardProps {
  pendingMessage: string;
  insufficiencyReason: string | null;
}

/**
 * 데이터 한계 및 유의사항 안내 컴포넌트
 */
export default function UncertaintyCard({
  pendingMessage,
  insufficiencyReason,
}: UncertaintyCardProps) {
  return (
    <section className="mb-10 rounded-[28px] border border-[#f2ddbc] bg-[linear-gradient(180deg,#fffaf2_0%,#fff5e7_100%)] p-6 shadow-[0_16px_32px_rgba(180,106,0,0.08)]">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#b46a00]">
        <span className="material-symbols-outlined text-sm">error</span>
        Uncertainty
      </h3>
      <div className="space-y-3 text-sm leading-6 text-[#495466]">
        <p>{pendingMessage}</p>
        <p>
          {insufficiencyReason ??
            "interpretation 단계로 넘길 preview를 준비 중이며, 근거 부족 여부는 이후 단계에서 다시 평가됩니다."}
        </p>
      </div>
    </section>
  );
}
