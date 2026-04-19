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
        <h3 className="flex items-center gap-2 text-xl font-black tracking-[-0.03em] text-[#191b24]">
          <span className="material-symbols-outlined text-[#0050cb]">fact_check</span>
          Evidence Snippets
        </h3>
        <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-[#0050cb]">
          {evidenceSnippets.length}건
        </span>
      </div>

      {evidenceSnippets.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#cbd5e1] bg-white px-5 py-8 text-sm leading-relaxed text-[#6b7280] shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
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
              className="block min-w-0 rounded-[24px] border border-[#e6ebf3] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c7dbff] hover:shadow-[0_18px_36px_rgba(0,80,203,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-start gap-4">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef5ff] text-[#0050cb]">
                    <span className="material-symbols-outlined">article</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0050cb]">
                      {snippet.sourceTypeLabel}
                    </p>
                    <h4 className="mt-1 line-clamp-2 overflow-hidden break-words text-sm font-bold text-[#191b24]">
                      {snippet.sourcePublisherName}
                    </h4>
                    <p className="mt-1 text-xs text-[#8a94a6]">
                      {snippet.publishedAtLabel}
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#c2c9d6]">
                  open_in_new
                </span>
              </div>

              <p className="mt-4 line-clamp-3 overflow-hidden break-words text-sm italic leading-6 text-[#48505d]">
                &quot;{snippet.snippetText}&quot;
              </p>
              <p className="mt-3 line-clamp-2 overflow-hidden break-words text-xs text-[#8a94a6]">
                {snippet.sourceTitle}
              </p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
