"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { mockReviews } from '@/lib/mock/reviews';
import { SourceType } from '@/lib/types/review';
import VerdictHero from '@/components/reviews/VerdictHero';
import AnalysisSummary from '@/components/reviews/AnalysisSummary';
import EvidenceGrid from '@/components/reviews/EvidenceGrid';
import SourceCard from '@/components/reviews/SourceCard';
import UncertaintyCard from '@/components/reviews/UncertaintyCard';

/**
 * 분석 결과 페이지 (/reviews/[reviewId])
 */
export default function ReviewResultPage() {
  const params = useParams();
  const router = useRouter();
  const reviewId = params.reviewId as string;
  
  // Mock 데이터 로드 (실제 환경에서는 API 호출)
  const review = mockReviews[reviewId] || mockReviews['mock-1'];
  
  // 출처 필터링 상태
  const [filter, setFilter] = useState<SourceType | 'All'>('All');

  // 필터링된 출처 목록
  const filteredSources = filter === 'All' 
    ? review.sources 
    : review.sources.filter(s => s.type === filter);

  if (!review) {
    return <div className="p-10 text-center">결과를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="bg-[#faf8ff] min-h-screen pb-32">
      {/* 상단 앱바 (TopAppBar) */}
      <header className="w-full sticky top-0 z-50 bg-[#faf8ff]/80 backdrop-blur-md flex items-center justify-between px-6 py-4 border-b border-[#c2c6d8]/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="text-[#0050cb] active:scale-95 duration-200 flex items-center"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-bold tracking-tight text-[#191b24] text-lg">
            Analysis Results
          </h1>
        </div>
        <button className="text-[#0050cb] active:scale-95 duration-200 flex items-center">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      <main className="px-6 pt-4 space-y-8 max-w-2xl mx-auto">
        {/* 최종 판정 섹션 */}
        <VerdictHero 
          claim={review.claim} 
          verdict={review.verdict} 
          confidence={review.confidence} 
        />

        {/* 교차 검증 일치도 (Veracity Meter) */}
        <section className="bg-white/50 rounded-xl p-6 border border-[#c2c6d8]/10">
          <h3 className="text-sm font-bold text-[#424656] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">analytics</span> 
            교차 검증 일치도
          </h3>
          <div className="relative h-3 w-full veracity-gradient rounded-full mb-2">
            <div 
              className="absolute h-5 w-3 bg-white rounded-full shadow-md border-2 border-[#0050cb] -top-1"
              style={{ right: `${100 - review.confidence}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] font-bold text-[#424656] uppercase tracking-tighter">
            <span>거짓</span>
            <span>불분명</span>
            <span>사실</span>
          </div>
        </section>

        {/* 분석 지표 (Bento Grid) */}
        <EvidenceGrid 
          distribution={review.distribution} 
          consensusLevel={review.consensusLevel} 
          consensusLabel={review.consensusLabel} 
        />

        {/* AI 심층 분석 요약 */}
        <AnalysisSummary interpretation={review.interpretation} />

        {/* 수집된 근거 목록 섹션 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#191b24] tracking-tight">
              수집된 근거 ({filteredSources.length})
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilter('All')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === 'All' ? 'bg-[#0050cb] text-white' : 'bg-[#e6e7f4] text-[#424656]'
                }`}
              >
                전체
              </button>
              <button 
                onClick={() => setFilter('Official')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === 'Official' ? 'bg-[#0050cb] text-white' : 'bg-[#e6e7f4] text-[#424656]'
                }`}
              >
                공식
              </button>
              <button 
                onClick={() => setFilter('Press')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  filter === 'Press' ? 'bg-[#0050cb] text-white' : 'bg-[#e6e7f4] text-[#424656]'
                }`}
              >
                언론
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredSources.map(source => (
              <SourceCard key={source.id} source={source} />
            ))}
            {filteredSources.length === 0 && (
              <div className="py-10 text-center text-[#424656] text-sm italic">
                해당 유형의 근거가 존재하지 않습니다.
              </div>
            )}
          </div>
        </section>

        {/* 데이터 한계 및 유의사항 */}
        <UncertaintyCard uncertainty={review.uncertainty} />
      </main>

      {/* 하단 네비게이션 (BottomNavBar - Stitch 디자인 반영) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-white/80 backdrop-blur-xl border-t border-[#c2c6d8]/15 shadow-[0_-4px_40px_rgba(25,27,36,0.06)] rounded-t-[24px]">
        <button 
          onClick={() => router.push('/')}
          className="flex flex-col items-center justify-center text-[#424656] px-5 py-2 hover:text-[#0050cb] transition-all"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[11px] font-medium uppercase tracking-wider mt-1">Home</span>
        </button>
        <button 
          className="flex flex-col items-center justify-center text-[#0050cb] font-bold bg-[#0066ff]/10 rounded-2xl px-5 py-2"
        >
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[11px] font-medium uppercase tracking-wider mt-1">Result</span>
        </button>
        <button 
          onClick={() => router.push('/community')}
          className="flex flex-col items-center justify-center text-[#424656] px-5 py-2 hover:text-[#0050cb] transition-all"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[11px] font-medium uppercase tracking-wider mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
}
