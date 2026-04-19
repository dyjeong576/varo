import { ReviewPreviewSource } from "@/lib/reviews/types";

interface SourceCardProps {
  source: ReviewPreviewSource;
}

function getSourceIcon(sourceCategory: ReviewPreviewSource["sourceCategory"]): string {
  switch (sourceCategory) {
    case "official":
      return "verified";
    case "press":
      return "newspaper";
    case "social":
      return "forum";
    case "analysis":
      return "analytics";
    default:
      return "public";
  }
}

function getSourceTone(source: ReviewPreviewSource): {
  container: string;
  icon: string;
  badge: string;
} {
  if (source.stance === "conflict") {
    return {
      container: "border-[#fde3df] bg-[#fff8f7]",
      icon: "bg-[#ffe8e4] text-[#ba1a1a]",
      badge: "bg-[#ffe8e4] text-[#ba1a1a]",
    };
  }

  if (source.stance === "support") {
    return {
      container: "border-[#dbe8ff] bg-white",
      icon: "bg-[#eef5ff] text-[#0050cb]",
      badge: "bg-[#eef5ff] text-[#0050cb]",
    };
  }

  return {
    container: "border-[#e8ecf4] bg-white",
    icon: "bg-[#f5f7fb] text-[#7b8798]",
    badge: "bg-[#f3f5f9] text-[#7b8798]",
  };
}

/**
 * 개별 출처 정보 카드 컴포넌트
 */
export default function SourceCard({ source }: SourceCardProps) {
  const tone = getSourceTone(source);

  return (
    <div
      className={`rounded-[24px] border p-5 shadow-[0_14px_32px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(15,23,42,0.08)] ${tone.container}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}
        >
          <span className="material-symbols-outlined">{getSourceIcon(source.sourceCategory)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-sm font-black text-[#191b24]">
                  {source.publisherName}
                </h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${tone.badge}`}
                >
                  {source.stanceLabel}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a94a6]">
                {source.sourceTypeLabel} · {source.publishedAtLabel}
              </p>
            </div>

            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#b2bac7] transition-colors hover:text-[#0050cb]"
              aria-label={`${source.publisherName} 원문 열기`}
            >
              <span className="material-symbols-outlined text-[20px]">open_in_new</span>
            </a>
          </div>

          <div className="mt-4 min-w-0 space-y-3">
            <h5 className="line-clamp-2 overflow-hidden break-words text-sm font-bold leading-6 text-[#191b24]">
              {source.title}
            </h5>
            <p className="line-clamp-3 overflow-hidden break-words rounded-2xl bg-[#f7f9fc] px-4 py-3 text-sm italic leading-6 text-[#48505d]">
              {source.snippet ? `"${source.snippet}"` : "표시할 snippet이 아직 없습니다."}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#6b7280]">
            <span className="rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1">
              {source.relevanceLabel}
            </span>
            <span className="rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1">
              {source.retrievalBucketLabel}
            </span>
            {source.relevanceReason ? (
              <span className="rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1">
                {source.relevanceReason}
              </span>
            ) : null}
            {source.originQueryIds.length > 0 ? (
              <span className="rounded-full border border-[#dce8ff] bg-[#f8fbff] px-2.5 py-1 text-[#0050cb]">
                질의 {source.originQueryIds.length}건 연결
              </span>
            ) : null}
            {source.domainRegistryMatched ? (
              <span className="rounded-full border border-[#dce8ff] bg-[#eef5ff] px-2.5 py-1 text-[#0050cb]">
                도메인 레지스트리 매칭
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
