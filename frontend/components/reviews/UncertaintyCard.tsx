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
    <section className="bg-[#ba1a1a]/5 border border-[#ba1a1a]/10 rounded-xl p-6 mb-10">
      <h3 className="text-sm font-bold text-[#ba1a1a] mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">error</span> 
        데이터 한계 및 유의사항
      </h3>
      <div className="space-y-2 text-xs leading-relaxed text-[#424656]">
        <p>{pendingMessage}</p>
        <p>
          {insufficiencyReason ??
            "interpretation 단계로 넘길 preview를 준비 중이며, 근거 부족 여부는 이후 단계에서 다시 평가됩니다."}
        </p>
      </div>
    </section>
  );
}
