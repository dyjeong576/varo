'use client';

import React from 'react';
import { PopularTopic } from '@/lib/types/popular';
import { PopularTopicCard } from './PopularTopicCard';

interface PopularTopicListProps {
  topics: PopularTopic[];
}

export const PopularTopicList: React.FC<PopularTopicListProps> = ({ topics }) => {
  return (
    <div className="flex flex-col gap-6">
      {topics.map((topic) => (
        <PopularTopicCard key={topic.topicKey} topic={topic} />
      ))}
    </div>
  );
};
