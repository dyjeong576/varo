"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { CommunityPost } from "@/lib/types/community";
import { PostCard } from "./post-card";

export function PostList() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const listLayoutClass =
    posts.length > 1 ? "grid grid-cols-1 gap-4 2xl:grid-cols-2 2xl:gap-5" : "space-y-4";

  useEffect(() => {
    async function loadPosts() {
      try {
        const nextPosts = await api.community.getPosts();
        setPosts(nextPosts);
        setErrorMessage(null);
      } catch (error) {
        console.error("Failed to load posts:", error);
        setErrorMessage("커뮤니티 피드를 불러오지 못했습니다.");
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
          <div
            key={i}
            className="rounded-2xl border border-gray-50 bg-white p-6 shadow-sm animate-pulse"
          >
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

  if (errorMessage) {
    return (
      <div className="rounded-2xl bg-white px-4 py-20 text-center xl:col-span-2">
        <p className="text-sm text-[#424656]">{errorMessage}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-4 py-20 text-center xl:col-span-2">
        <p className="text-sm text-gray-400">
          아직 등록된 게시글이 없습니다.
          <br />
          첫 번째 의견을 남겨보세요.
        </p>
      </div>
    );
  }

  return (
    <div className={listLayoutClass}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
