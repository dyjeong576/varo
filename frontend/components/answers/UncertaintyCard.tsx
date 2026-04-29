interface UncertaintyCardProps {
  pendingMessage: string;
  insufficiencyReason: string | null;
  uncertaintySummary: string;
  uncertaintyItems: string[];
}

/**
 * 데이터 한계 및 유의사항 안내 컴포넌트
 */
export default function UncertaintyCard({
  pendingMessage,
  insufficiencyReason,
  uncertaintySummary,
  uncertaintyItems,
}: UncertaintyCardProps) {
  const items = [...uncertaintyItems];

  if (insufficiencyReason && !items.includes(insufficiencyReason)) {
    items.unshift(insufficiencyReason);
  }

  return (
    <section className="mb-10 rounded-xl border border-[#f2ddbc] bg-[linear-gradient(180deg,#fffaf2_0%,#fff5e7_100%)] p-6 shadow-[0_16px_32px_rgba(180,106,0,0.08)]">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#b46a00]">
        <span className="material-symbols-outlined text-sm">error</span>
        데이터 한계 및 유의사항
      </h3>
      <div className="space-y-3 text-sm leading-6 text-[#495466]">
        <p>{uncertaintySummary}</p>
        <p>{pendingMessage}</p>
        {items.length > 0 ? (
          <ul className="space-y-2 text-xs text-[#6b7280]">
            {items.map((item) => (
              <li key={item} className="rounded-lg bg-white/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
