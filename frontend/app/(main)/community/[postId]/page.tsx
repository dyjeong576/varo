"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, ThumbsUp, Send } from "lucide-react";
import { CommunityPost, Comment } from "@/lib/api/types";
import { mockCommunityPosts, mockCommunityComments } from "@/lib/mock-data";

interface PostDetailPageProps {
  params: Promise<{ postId: string }>;
}

export default function PostDetailPage({ params }: PostDetailPageProps) {
  const { postId } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPostDetail() {
      try {
        await new Promise(resolve => setTimeout(resolve, 600));
        const foundPost = mockCommunityPosts.find(p => p.id === postId);
        if (foundPost) {
          setPost(foundPost as any);
          const postComments = mockCommunityComments.filter(c => c.postId === postId);
          setComments(postComments as any);
        }
      } catch (error) {
        console.error("Failed to load post:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPostDetail();
  }, [postId]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Issue': return 'text-[#0050cb] bg-[#0050cb]/5';
      case 'Policy': return 'text-[#0050cb] bg-[#0050cb]/5';
      case 'FactCheck': return 'text-[#0050cb] bg-[#0050cb]/5';
      default: return 'text-[#0050cb] bg-[#0050cb]/5';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#0050cb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-10 text-center">
        <p className="text-[#424656] mb-4">게시글을 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="text-[#0050cb] font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="pb-32 min-h-full bg-white max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-40 px-4 py-3 border-b border-[#f2f3ff] flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 -ml-1 hover:bg-[#f2f3ff] rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-[#191b24]" />
        </button>
        <h2 className="text-lg font-bold text-[#191b24] truncate">의견 상세</h2>
      </div>

      {/* Main Content */}
      <article className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#bac7de] rounded-full flex items-center justify-center text-[#0050cb] font-bold text-lg">
            {post.author.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#191b24]">{post.author.name}</span>
              <span className="text-[10px] text-[#424656] bg-[#f2f3ff] px-1.5 py-0.5 rounded">
                {post.author.gender} · {post.author.ageGroup}
              </span>
            </div>
            <span className="text-[11px] text-[#727687]">
              {new Date(post.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="ml-auto">
             <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${getCategoryColor(post.category)}`}>
              {post.category}
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#191b24] mb-4 leading-tight tracking-tight">
          {post.title}
        </h1>
        
        <p className="text-[#191b24] leading-relaxed whitespace-pre-wrap mb-10 text-[16px]">
          {post.content}
        </p>

        <div className="flex items-center gap-6 py-4 border-y border-[#f2f3ff]">
          <div className="flex items-center gap-1.5 text-[#424656] cursor-pointer active:scale-95 transition-transform">
            <ThumbsUp className="w-5 h-5" />
            <span className="text-sm font-semibold">공감 {post.likeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#424656]">
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-semibold">댓글 {comments.length}</span>
          </div>
        </div>
      </article>

      {/* Comments Section */}
      <section className="bg-[#faf8ff] pb-10">
        <div className="px-4 py-4 border-b border-[#f2f3ff] bg-white">
          <h3 className="font-bold text-[#191b24]">전체 댓글 {comments.length}</h3>
        </div>
        
        <div className="divide-y divide-[#f2f3ff]">
          {comments.map((comment) => (
            <div key={comment.id} className="p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-[#bac7de] rounded-full flex items-center justify-center text-[#0050cb] font-bold text-[10px]">
                  {comment.author.name[0]}
                </div>
                <span className="text-sm font-bold text-[#191b24]">{comment.author.name}</span>
                <span className="text-[10px] text-[#727687]">
                  {comment.author.gender} · {comment.author.ageGroup}
                </span>
                <span className="text-[10px] text-[#727687] ml-auto">
                  {new Date(comment.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-sm text-[#191b24] leading-relaxed pl-8">
                {comment.content}
              </p>
            </div>
          ))}
          
          {comments.length === 0 && (
            <div className="py-12 text-center bg-white border-b border-[#f2f3ff]">
              <p className="text-sm text-[#727687]">등록된 댓글이 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      {/* Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-[#f2f3ff] flex items-center gap-2 z-50 max-w-2xl mx-auto">
        <div className="flex-1 bg-[#f2f3ff] rounded-2xl px-4 py-2.5 flex items-center">
          <input 
            type="text" 
            placeholder="책임 있는 댓글을 입력해주세요" 
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#191b24] placeholder:text-[#727687]"
          />
        </div>
        <button className="p-2.5 bg-[#0066ff] text-white rounded-full active:scale-90 transition-transform shadow-lg">
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
