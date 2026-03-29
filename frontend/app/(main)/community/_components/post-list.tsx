"use client";

import { useEffect, useState } from "react";
import { mockCommunityPosts } from "@/lib/mock-data";
import type { CommunityPost } from "@/lib/types/community";
import { PostCard } from "./post-card";

export function PostList() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        // 실제 API 대신 Mock 데이터 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 800));
        setPosts(mockCommunityPosts);
      } catch (error) {
        console.error("Failed to load posts:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPosts();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse border border-gray-50">
            <div className="flex justify-between items-start mb-3">
              <div className="w-3/4 h-6 bg-gray-100 rounded" />
              <div className="w-16 h-5 bg-gray-50 rounded" />
            </div>
            <div className="w-full h-4 bg-gray-50 rounded mb-2" />
            <div className="w-2/3 h-4 bg-gray-50 rounded mb-6" />
            <div className="flex items-center justify-between border-t border-gray-50 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="w-24 h-4 bg-gray-50 rounded" />
              </div>
              <div className="flex gap-4">
                <div className="w-12 h-4 bg-gray-50 rounded" />
                <div className="w-12 h-4 bg-gray-50 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-xl">
        <p className="text-gray-400 text-sm">아직 등록된 게시글이 없습니다.<br />첫 번째 의견을 남겨보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
