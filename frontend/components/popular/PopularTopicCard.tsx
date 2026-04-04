'use client';

import React from 'react';
import Link from 'next/link';
import { PopularTopic } from '@/lib/types/popular';
import { buildReviewEntryHref } from '@/lib/reviews/navigation';

interface PopularTopicCardProps {
  topic: PopularTopic;
}

export const PopularTopicCard: React.FC<PopularTopicCardProps> = ({ topic }) => {
  const updatedAtLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(topic.updatedAt));

  const getTrendIcon = () => {
    switch (topic.trend) {
      case 'up': return 'arrow_upward';
      case 'down': return 'arrow_downward';
      case 'steady': return 'horizontal_rule';
      default: return 'horizontal_rule';
    }
  };

  const getTrendColor = () => {
    switch (topic.trend) {
      case 'up': return 'text-primary';
      case 'down': return 'text-error';
      case 'steady': return 'text-outline-variant';
      default: return 'text-outline-variant';
    }
  };

  const getTrendLabel = () => {
    if (topic.trendValue !== null) {
      return `${Math.abs(topic.trendValue)}%`;
    }

    switch (topic.trend) {
      case 'up':
        return '상승';
      case 'down':
        return '하락';
      default:
        return '변동 없음';
    }
  };

  return (
    <Link href={buildReviewEntryHref(topic.representativeReviewId, 'popular')} className="block">
      <article className="group relative flex items-start gap-6 p-6 bg-surface-container-lowest rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,80,203,0.08)] transition-all duration-300 cursor-pointer">
        <div className="flex-none flex items-center justify-center w-12 h-12">
          <span className={`text-3xl font-black italic ${topic.rank === 1 ? 'text-primary opacity-90' : 'text-on-surface-variant/30'}`}>
            {topic.rank}
          </span>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-on-surface-variant/60">최근 업데이트 {updatedAtLabel}</span>
          </div>
          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
            {topic.topicText}
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              합산 점수 {topic.popularityScore.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="material-symbols-outlined text-sm">article</span>
              요청 {topic.reviewCount.toLocaleString()}건
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="material-symbols-outlined text-sm">history</span>
              재열람 {topic.reopenCount.toLocaleString()}건
            </span>
            <span className={`flex items-center gap-1 ${getTrendColor()}`}>
              <span className="material-symbols-outlined text-sm">{getTrendIcon()}</span>
              {getTrendLabel()}
            </span>
          </div>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-primary">chevron_right</span>
        </div>
      </article>
    </Link>
  );
};
