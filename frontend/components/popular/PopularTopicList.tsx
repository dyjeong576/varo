'use client';

import React from 'react';
import { PopularTopic } from '@/lib/types/popular';
import { PopularTopicCard } from './PopularTopicCard';

interface PopularTopicListProps {
  topics: PopularTopic[];
}

export const PopularTopicList: React.FC<PopularTopicListProps> = ({ topics }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        {topics.map((topic) => (
          <PopularTopicCard key={topic.id} topic={topic} />
        ))}
      </div>
      
      <div className="mt-16 flex justify-center">
        <button className="flex items-center gap-3 px-8 py-4 bg-surface-container-high text-foreground font-bold rounded-full hover:bg-primary/10 transition-colors active:scale-95 duration-150">
          <span>인기 주제 더보기</span>
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </div>
  );
};
