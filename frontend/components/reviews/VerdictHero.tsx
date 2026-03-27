import { Verdict } from '@/lib/types/review';

interface VerdictHeroProps {
  claim: string;
  verdict: Verdict;
  confidence: number;
}

/**
 * 최종 판정 및 주장 섹션 컴포넌트
 */
export default function VerdictHero({ claim, verdict, confidence }: VerdictHeroProps) {
  // 판정에 따른 레이블 매핑
  const verdictLabels: Record<Verdict, string> = {
    'Likely True': '대체로 사실 (Likely True)',
    'Mixed Evidence': '근거 혼재 (Mixed Evidence)',
    'Unclear': '불분명 (Unclear)',
    'Likely False': '대체로 거짓 (Likely False)',
  };

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#c2c6d8]/15">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#0050cb]">
            최종 분석 결과
          </span>
          <span className="bg-[#0066ff]/10 text-[#0066ff] px-3 py-1 rounded-full text-xs font-bold">
            검증 완료
          </span>
        </div>
        
        <h2 className="text-2xl font-extrabold text-[#191b24] leading-tight mb-2 tracking-tight">
          &quot;{claim}&quot;
        </h2>
        
        <div className="flex items-center gap-3 mt-6">
          <div className="h-12 w-12 bg-[#0050cb] rounded-full flex items-center justify-center text-white shrink-0 shadow-md">
            <span className="material-symbols-outlined !text-[24px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
              verified
            </span>
          </div>
          <div>
            <p className="text-[#0050cb] font-bold text-xl leading-none mb-1">{verdictLabels[verdict]}</p>
            <p className="text-[#424656] text-sm">Verifi AI 분석 신뢰도 {confidence}%</p>
          </div>
        </div>
      </div>
    </section>
  );
}
