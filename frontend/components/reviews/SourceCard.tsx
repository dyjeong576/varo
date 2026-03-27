import { Source } from '@/lib/types/review';

interface SourceCardProps {
  source: Source;
}

/**
 * 개별 출처 정보 카드 컴포넌트
 */
export default function SourceCard({ source }: SourceCardProps) {
  // 출처 유형별 한글 레이블 및 스타일
  const typeLabels: Record<string, string> = {
    'Official': '공식',
    'Press': '언론',
    'Social': '소셜',
    'Analysis': '해설',
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-[#c2c6d8]/10 shadow-sm space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] flex items-center justify-center overflow-hidden border border-[#c2c6d8]/10">
            {source.logoUrl ? (
              <img 
                src={source.logoUrl} 
                alt={source.name} 
                className="w-8 h-8 object-contain"
              />
            ) : (
              <span className="material-symbols-outlined text-[#424656]">description</span>
            )}
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#191b24]">{source.name}</h4>
            <p className="text-[10px] text-[#424656] uppercase font-medium">
              {source.publishTime} · <span className="text-[#0050cb]">{typeLabels[source.type] || source.type}</span>
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

      <p className="text-sm text-[#191b24] leading-snug bg-[#f2f3ff]/50 p-3 rounded-lg border border-[#c2c6d8]/5">
        &quot;{source.snippet}&quot;
      </p>

      <div className="flex justify-between items-center pt-2">
        <span className="text-[10px] font-bold text-[#0050cb] flex items-center gap-1">
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span> 
          {source.reliabilityLabel}
        </span>
        <button className="text-[#424656] flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-[#0050cb] transition-colors">
          내용 확장 <span className="material-symbols-outlined text-xs">expand_more</span>
        </button>
      </div>
    </div>
  );
}
