'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { PopularTopic } from '@/lib/types/popular';
import { PopularTopicList } from './PopularTopicList';

export const PopularTopicFeed = () => {
  const [topics, setTopics] = useState<PopularTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadTopics() {
      try {
        const nextTopics = await api.popular.getTopics();
        setTopics(nextTopics);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load popular topics:', error);
        setErrorMessage('인기 주제를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadTopics();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="rounded-3xl bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] animate-pulse"
          >
            <div className="flex items-start gap-6">
              <div className="h-12 w-12 rounded-2xl bg-surface-container-high" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-28 rounded-full bg-surface-container-high" />
                <div className="h-6 w-3/4 rounded-full bg-surface-container-high" />
                <div className="flex gap-3">
                  <div className="h-4 w-32 rounded-full bg-surface-container-high" />
                  <div className="h-4 w-20 rounded-full bg-surface-container-high" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl bg-surface-container-lowest px-6 py-16 text-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <p className="text-sm text-on-surface-variant">{errorMessage}</p>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-3xl bg-surface-container-lowest px-6 py-16 text-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <p className="text-sm text-on-surface-variant">
          아직 집계된 인기 주제가 없습니다.
          <br />
          최근 24시간 합산 점수가 10 이상인 topic이 생기면 이곳에 표시됩니다.
        </p>
      </div>
    );
  }

  return <PopularTopicList topics={topics} />;
};
