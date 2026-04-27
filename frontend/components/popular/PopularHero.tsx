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
        최근 24시간 동안 많이 검색되고 주목받은 주제만 모아 보여드려요.
      </p>
    </section>
  );
};
