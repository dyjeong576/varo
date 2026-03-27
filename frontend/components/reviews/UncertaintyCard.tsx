interface UncertaintyCardProps {
  uncertainty: string;
}

/**
 * 데이터 한계 및 유의사항 안내 컴포넌트
 */
export default function UncertaintyCard({ uncertainty }: UncertaintyCardProps) {
  return (
    <section className="bg-[#ba1a1a]/5 border border-[#ba1a1a]/10 rounded-xl p-6 mb-10">
      <h3 className="text-sm font-bold text-[#ba1a1a] mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">error</span> 
        데이터 한계 및 유의사항
      </h3>
      <p className="text-xs text-[#424656] leading-relaxed">
        {uncertainty}
      </p>
    </section>
  );
}
