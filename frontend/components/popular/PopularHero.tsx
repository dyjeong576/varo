'use client';

import React from 'react';

export const PopularHero = () => {
  return (
    <section className="mb-12">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 mb-4">
        <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
        <span className="text-xs font-bold text-primary tracking-wide">인기 검색 주제</span>
      </div>
      <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter leading-tight mb-4">
        최근 24시간 동안<br />가장 많이 요청되거나 다시 확인된 <span className="bg-gradient-to-r from-[#0050cb] to-[#0066ff] bg-clip-text text-transparent inline-block">주제</span>
      </h2>
      <p className="text-on-surface-variant leading-relaxed text-lg max-w-xl">
        검토가 완료된 preview의 새 요청과 의미 있는 재진입을 함께 반영해, 최근 24시간 합산 점수가 10 이상인 topic만 보여줍니다.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-base text-primary">schedule</span>
        최근 24시간 · 요청+재열람 합산 10점 이상 · 합산 점수 우선 정렬
      </div>
    </section>
  );
};
