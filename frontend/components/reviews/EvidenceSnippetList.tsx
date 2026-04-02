import { ReviewPreviewEvidenceSnippet } from "@/lib/reviews/types";

interface EvidenceSnippetListProps {
  evidenceSnippets: ReviewPreviewEvidenceSnippet[];
}

export default function EvidenceSnippetList({
  evidenceSnippets,
}: EvidenceSnippetListProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#191b24] tracking-tight">
          핵심 evidence snippet
        </h3>
        <span className="rounded-full bg-[#f2f3ff] px-3 py-1 text-xs font-bold text-[#0050cb]">
          {evidenceSnippets.length}건
        </span>
      </div>

      {evidenceSnippets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c2c6d8] bg-white px-5 py-8 text-sm leading-relaxed text-[#6b7280]">
          아직 추출된 evidence snippet이 없습니다. source 카드에 남아 있는 raw snippet과 메타데이터를 먼저 확인해 주세요.
        </div>
      ) : (
        <div className="space-y-3">
          {evidenceSnippets.map((snippet) => (
            <a
              key={snippet.id}
              href={snippet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-[#c2c6d8]/15 bg-white p-5 shadow-sm transition-colors hover:border-[#9bb8ff]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#0050cb]">
                    {snippet.sourceTypeLabel}
                  </p>
                  <h4 className="mt-1 text-sm font-bold text-[#191b24]">
                    {snippet.sourcePublisherName}
                  </h4>
                  <p className="mt-1 text-xs text-[#6b7280]">
                    {snippet.publishedAtLabel}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[#c2c6d8]">
                  open_in_new
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-[#191b24]">
                “{snippet.snippetText}”
              </p>
              <p className="mt-3 text-xs text-[#6b7280]">{snippet.sourceTitle}</p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
