'use client';

import React from 'react';

export const PopularHero = () => {
  return (
    <section className="mb-12">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 mb-4">
        <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
        <span className="text-xs font-bold text-primary tracking-wide">실시간 인기 주제</span>
      </div>
      <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter leading-tight mb-4">
        지금 대한민국에서<br />가장 궁금해하는 <span className="bg-gradient-to-r from-[#0050cb] to-[#0066ff] bg-clip-text text-transparent inline-block">팩트</span>
      </h2>
      <p className="text-on-surface-variant leading-relaxed text-lg max-w-xl">
        수집된 제보를 바탕으로 현재 가장 뜨거운 이슈의 진위를 확인하고 있습니다. 투명한 정보의 가치를 경험하세요.
      </p>
      
      {/* Search Bar - Included in Hero as per Stitch structure */}
      <div className="relative mt-10">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-outline-variant">search</span>
        </div>
        <input 
          type="text"
          className="w-full h-14 pl-14 pr-6 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-on-surface-variant/60 outline-none" 
          placeholder="검색어를 입력하여 팩트체크를 시작하세요"
        />
      </div>
    </section>
  );
};
