"use client";

import Link from "next/link";
import { MessageSquare, ThumbsUp } from "lucide-react";
import type { CommunityPost } from "@/lib/types/community";
import { formatCommunityDateTime } from "@/lib/community/format";

interface PostCardProps {
  post: CommunityPost;
  onToggleLike: (postId: string, likedByMe: boolean) => Promise<void>;
  isLikeSubmitting: boolean;
}

export function PostCard({ post, onToggleLike, isLikeSubmitting }: PostCardProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Issue': return 'text-[#0050cb] bg-[#0050cb]/5';
      case 'Policy': return 'text-[#0050cb] bg-[#0050cb]/5';
      case 'FactCheck': return 'text-[#0050cb] bg-[#0050cb]/5';
      default: return 'text-[#0050cb] bg-[#0050cb]/5';
    }
  };

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg lg:p-6">
      <Link href={`/community/${post.id}`} className="block">
        <div className="mb-4 flex items-start gap-3">
          <h2 className="flex-1 text-xl font-bold leading-snug tracking-tight text-[#191b24] line-clamp-2">
            {post.title}
          </h2>
          <span
            className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getCategoryColor(post.category)}`}
          >
            {post.category}
          </span>
        </div>
      </Link>

      <div className="mt-auto flex flex-col gap-3 border-t border-[#f2f3ff] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#bac7de] flex items-center justify-center text-[#0050cb] font-bold text-xs">
            {post.author.name[0]}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[#191b24]">
              {post.author.name} ({post.author.gender}·{post.author.ageGroup})
            </div>
            <div className="text-xs text-[#727687]">
              {formatCommunityDateTime(post.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-medium text-[#424656]">
          <Link
            href={`/community/${post.id}`}
            className="flex items-center gap-1"
          >
            <MessageSquare className="w-[18px] h-[18px]" />
            <span>댓글 {post.commentCount}</span>
          </Link>
          <button
            type="button"
            disabled={isLikeSubmitting}
            onClick={() => {
              if (isLikeSubmitting) {
                return;
              }

              void onToggleLike(post.id, post.likedByMe);
            }}
            className={`flex items-center gap-1 transition-colors disabled:cursor-not-allowed ${
              post.likedByMe ? "text-[#0050cb]" : "hover:text-[#0050cb]"
            } ${isLikeSubmitting ? "opacity-60" : ""}`}
          >
            <ThumbsUp className="w-[18px] h-[18px]" />
            <span>공감 {post.likeCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
