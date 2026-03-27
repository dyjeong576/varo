"use client";

import Link from "next/link";
import { MessageSquare, ThumbsUp } from "lucide-react";
import { CommunityPost } from "@/lib/api/types";

interface PostCardProps {
  post: CommunityPost;
}

export function PostCard({ post }: PostCardProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Issue': return 'text-[#0050cb] bg-[#0050cb]/5';
      case 'Policy': return 'text-[#0050cb] bg-[#0050cb]/5';
      case 'FactCheck': return 'text-[#0050cb] bg-[#0050cb]/5';
      default: return 'text-[#0050cb] bg-[#0050cb]/5';
    }
  };

  return (
    <Link
      href={`/community/${post.id}`}
      className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-50 mb-4"
    >
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl font-bold text-[#191b24] tracking-tight leading-snug">
          {post.title}
        </h2>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${getCategoryColor(post.category)}`}>
          {post.category}
        </span>
      </div>
      
      <p className="text-[#424656] text-[15px] leading-relaxed mb-6 line-clamp-2">
        {post.content}
      </p>

      <div className="flex items-center justify-between border-t border-[#f2f3ff] pt-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#bac7de] flex items-center justify-center text-[#0050cb] font-bold text-xs">
            {post.author.name[0]}
          </div>
          <span className="text-sm font-medium text-[#191b24]">
            {post.author.name} ({post.author.gender}·{post.author.ageGroup})
          </span>
        </div>
        <div className="flex gap-4 text-[#424656] text-sm font-medium">
          <div className="flex items-center gap-1 group">
            <MessageSquare className="w-[18px] h-[18px]" />
            <span>댓글 {post.commentCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <ThumbsUp className="w-[18px] h-[18px]" />
            <span>공감 {post.likeCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
