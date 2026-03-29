import React from 'react';
import { PopularHero } from '@/components/popular/PopularHero';
import { PopularTopicList } from '@/components/popular/PopularTopicList';
import { mockPopularTopics } from '@/lib/mock-data';

export const metadata = {
  title: '인기 주제 | VARO',
  description: '지금 대한민국에서 가장 궁금해하는 팩트를 확인하세요.',
};

export default function PopularPage() {
  return (
    <main className="pt-8 pb-32 px-6 max-w-3xl mx-auto min-h-screen">
      <PopularHero />
      <PopularTopicList topics={mockPopularTopics} />
    </main>
  );
}
