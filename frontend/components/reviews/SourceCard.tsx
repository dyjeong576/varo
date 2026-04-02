import { ReviewPreviewSource } from "@/lib/reviews/types";

interface SourceCardProps {
  source: ReviewPreviewSource;
}

/**
 * 개별 출처 정보 카드 컴포넌트
 */
export default function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 border border-[#c2c6d8]/10 shadow-sm space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] flex items-center justify-center overflow-hidden border border-[#c2c6d8]/10">
            <span className="material-symbols-outlined text-[#424656]">description</span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#191b24]">{source.publisherName}</h4>
            <p className="text-[10px] text-[#424656] uppercase font-medium">
              {source.publishedAtLabel} · <span className="text-[#0050cb]">{source.sourceTypeLabel}</span>
            </p>
          </div>
        </div>
        <a 
          href={source.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[#c2c6d8] hover:text-[#0050cb] transition-colors"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </a>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-semibold text-[#191b24] leading-snug">
          {source.title}
        </h5>
        <p className="text-sm text-[#191b24] leading-snug bg-[#f2f3ff]/50 p-3 rounded-lg border border-[#c2c6d8]/5">
          {source.snippet ? `“${source.snippet}”` : "표시할 snippet이 아직 없습니다."}
        </p>
      </div>

      <div className="flex justify-between items-center pt-2">
        <span className="text-[10px] font-bold text-[#0050cb] flex items-center gap-1">
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span> 
          {source.relevanceLabel}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#424656]">
          {source.retrievalBucketLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-[#6b7280]">
        {source.relevanceReason ? (
          <span className="rounded-full bg-[#f9fafb] px-2.5 py-1 border border-[#e5e7eb]">
            {source.relevanceReason}
          </span>
        ) : null}
        {source.domainRegistryMatched ? (
          <span className="rounded-full bg-[#eef6ff] px-2.5 py-1 border border-[#d6e3fb] text-[#0050cb]">
            도메인 레지스트리 매칭
          </span>
        ) : null}
      </div>
    </div>
  );
}
