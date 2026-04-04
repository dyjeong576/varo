"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Pencil, Send, ThumbsUp, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatCommunityDateTime } from "@/lib/community/format";
import { ApiClientError } from "@/lib/api/http";
import { CommunityComment, CommunityPostDetail } from "@/lib/types/community";

interface PostDetailPageProps {
  params: Promise<{ postId: string }>;
}

interface CommentThreadProps {
  postId: string;
  comment: CommunityComment;
  onToggleLike: (commentId: string, likedByMe: boolean) => Promise<void>;
  onReply: (parentCommentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

function updateCommentTree(
  comments: CommunityComment[],
  commentId: string,
  updater: (comment: CommunityComment) => CommunityComment,
): CommunityComment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return updater(comment);
    }

    return {
      ...comment,
      replies: updateCommentTree(comment.replies ?? [], commentId, updater),
    };
  });
}

function CommentThread({ postId, comment, onToggleLike, onReply, onDelete }: CommentThreadProps) {
  const [replyInput, setReplyInput] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isLikeSubmitting, setIsLikeSubmitting] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const replies = comment.replies ?? [];

  return (
    <div className="bg-white">
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#bac7de] text-[10px] font-bold text-[#0050cb]">
            {comment.author.name[0]}
          </div>
          <span className="text-sm font-bold text-[#191b24]">{comment.author.name}</span>
          <span className="text-[10px] text-[#727687]">
            {comment.author.gender} · {comment.author.ageGroup}
          </span>
          <span className="ml-auto text-[10px] text-[#727687]">
            {formatCommunityDateTime(comment.createdAt)}
          </span>
        </div>
        <p className="pl-8 text-sm leading-relaxed text-[#191b24]">{comment.content}</p>
        <div className="mt-3 flex items-center gap-4 pl-8">
          <button
            disabled={isLikeSubmitting}
            onClick={async () => {
              setIsLikeSubmitting(true);
              try {
                await onToggleLike(comment.id, comment.likedByMe);
              } finally {
                setIsLikeSubmitting(false);
              }
            }}
            className={`inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-60 ${
              comment.likedByMe ? "text-[#0050cb]" : "text-[#727687]"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            좋아요 {comment.likeCount}
          </button>
          <button
            onClick={() => setIsReplying((current) => !current)}
            className="text-xs font-semibold text-[#727687]"
          >
            답글
          </button>
          {comment.isAuthor ? (
            <button
              disabled={isDeleteSubmitting}
              onClick={async () => {
                if (!window.confirm("이 댓글을 삭제하시겠습니까? 대댓글도 함께 삭제됩니다.")) {
                  return;
                }

                setIsDeleteSubmitting(true);
                try {
                  await onDelete(comment.id);
                } finally {
                  setIsDeleteSubmitting(false);
                }
              }}
              className="text-xs font-semibold text-[#c43232] disabled:opacity-60"
            >
              삭제
            </button>
          ) : null}
        </div>
        {isReplying ? (
          <div className="mt-3 pl-8">
            <div className="flex items-center gap-2 rounded-2xl bg-[#f2f3ff] px-3 py-2">
              <input
                type="text"
                value={replyInput}
                onChange={(event) => setReplyInput(event.target.value)}
                placeholder="대댓글을 입력해주세요"
                className="flex-1 bg-transparent text-sm text-[#191b24] outline-none placeholder:text-[#727687]"
              />
              <button
                disabled={!replyInput.trim() || isSubmittingReply}
                onClick={async () => {
                  const content = replyInput.trim();

                  if (!content) {
                    return;
                  }

                  setIsSubmittingReply(true);
                  try {
                    await onReply(comment.id, content);
                    setReplyInput("");
                    setIsReplying(false);
                  } finally {
                    setIsSubmittingReply(false);
                  }
                }}
                className="rounded-full bg-[#0066ff] p-2 text-white disabled:bg-[#b6c7ee]"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {replies.length > 0 ? (
        <div className="space-y-0 border-t border-[#f6f7fb] bg-[#fbfbff] pl-6">
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              postId={postId}
              comment={reply}
              onToggleLike={onToggleLike}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PostDetailPage({ params }: PostDetailPageProps) {
  const { postId } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [isLikeSubmitting, setIsLikeSubmitting] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  useEffect(() => {
    async function loadPostDetail() {
      try {
        const nextPost = await api.community.getPostDetail(postId);
        setPost(nextPost);
        setErrorMessage(null);
      } catch (error) {
        console.error("Failed to load post:", error);
        if (error instanceof ApiClientError && error.status === 404) {
          setErrorMessage("게시글을 찾을 수 없습니다.");
        } else {
          setErrorMessage("게시글 상세를 불러오지 못했습니다.");
        }
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
        <p className="text-[#424656] mb-4">{errorMessage ?? "게시글을 찾을 수 없습니다."}</p>
        <button onClick={() => router.back()} className="text-[#0050cb] font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-4xl bg-white pb-48">
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-[#f2f3ff] bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
        <button onClick={() => router.back()} className="p-1 -ml-1 hover:bg-[#f2f3ff] rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-[#191b24]" />
        </button>
        <h2 className="text-lg font-bold text-[#191b24] truncate">의견 상세</h2>
        {post.isAuthor ? (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => router.push(`/community/${post.id}/edit`)}
              className="inline-flex items-center gap-1 rounded-full bg-[#f2f3ff] px-3 py-1.5 text-xs font-semibold text-[#191b24]"
            >
              <Pencil className="h-3.5 w-3.5" />
              수정
            </button>
            <button
              disabled={isDeleteSubmitting}
              onClick={async () => {
                if (!window.confirm("이 게시글을 삭제하시겠습니까?")) {
                  return;
                }

                setIsDeleteSubmitting(true);
                try {
                  await api.community.deletePost(post.id);
                  router.replace("/community");
                  router.refresh();
                } catch (error) {
                  console.error("Failed to delete post:", error);
                  if (error instanceof ApiClientError) {
                    setErrorMessage(error.message);
                  } else {
                    setErrorMessage("게시글을 삭제하지 못했습니다.");
                  }
                  setIsDeleteSubmitting(false);
                }
              }}
              className="inline-flex items-center gap-1 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-semibold text-[#c43232] disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </div>
        ) : null}
      </div>

      <article className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
              {formatCommunityDateTime(post.createdAt)}
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

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-[#ffd7d7] bg-[#fff6f6] px-4 py-3 text-sm text-[#b42318]">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center gap-6 py-4 border-y border-[#f2f3ff]">
          <button
            disabled={isLikeSubmitting}
            onClick={async () => {
              setIsLikeSubmitting(true);
              try {
                const nextLikeState = post.likedByMe
                  ? await api.community.removeLike(post.id)
                  : await api.community.addLike(post.id);

                setPost((current) =>
                  current
                    ? {
                        ...current,
                        likedByMe: nextLikeState.likedByMe,
                        likeCount: nextLikeState.likeCount,
                      }
                    : current,
                );
                setErrorMessage(null);
              } catch (error) {
                console.error("Failed to toggle like:", error);
                if (error instanceof ApiClientError) {
                  setErrorMessage(error.message);
                } else {
                  setErrorMessage("공감 상태를 변경하지 못했습니다.");
                }
              } finally {
                setIsLikeSubmitting(false);
              }
            }}
            className={`flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60 ${
              post.likedByMe ? "text-[#0050cb]" : "text-[#424656]"
            }`}
          >
            <ThumbsUp className="w-5 h-5" />
            <span className="text-sm font-semibold">공감 {post.likeCount}</span>
          </button>
          <div className="flex items-center gap-1.5 text-[#424656]">
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-semibold">댓글 {post.commentCount}</span>
          </div>
        </div>
      </article>

      <section className="bg-[#faf8ff] pb-24">
        <div className="border-b border-[#f2f3ff] bg-white px-4 py-4 sm:px-6 lg:px-8">
          <h3 className="font-bold text-[#191b24]">전체 댓글 {post.commentCount}</h3>
        </div>
        
        <div className="divide-y divide-[#f2f3ff]">
          {post.comments.map((comment) => (
            <CommentThread
              key={comment.id}
              postId={post.id}
              comment={comment}
              onToggleLike={async (commentId, likedByMe) => {
                try {
                  const nextState = likedByMe
                    ? await api.community.removeCommentLike(post.id, commentId)
                    : await api.community.addCommentLike(post.id, commentId);

                  setPost((current) =>
                    current
                      ? {
                          ...current,
                          comments: updateCommentTree(current.comments, commentId, (target) => ({
                            ...target,
                            likedByMe: nextState.likedByMe,
                            likeCount: nextState.likeCount,
                          })),
                        }
                      : current,
                  );
                  setErrorMessage(null);
                } catch (error) {
                  console.error("Failed to toggle comment like:", error);
                  if (error instanceof ApiClientError) {
                    setErrorMessage(error.message);
                  } else {
                    setErrorMessage("댓글 좋아요 상태를 변경하지 못했습니다.");
                  }
                }
              }}
              onReply={async (parentCommentId, content) => {
                try {
                  const updated = await api.community.createComment(post.id, {
                    content,
                    parentCommentId,
                  });
                  setPost(updated);
                  setErrorMessage(null);
                } catch (error) {
                  console.error("Failed to create reply:", error);
                  if (error instanceof ApiClientError) {
                    setErrorMessage(error.message);
                  } else {
                    setErrorMessage("대댓글을 등록하지 못했습니다.");
                  }
                }
              }}
              onDelete={async (commentId) => {
                try {
                  const updated = await api.community.deleteComment(post.id, commentId);
                  setPost(updated);
                  setErrorMessage(null);
                } catch (error) {
                  console.error("Failed to delete comment:", error);
                  if (error instanceof ApiClientError) {
                    setErrorMessage(error.message);
                  } else {
                    setErrorMessage("댓글을 삭제하지 못했습니다.");
                  }
                }
              }}
            />
          ))}
          
          {post.commentCount === 0 && (
            <div className="py-12 text-center bg-white border-b border-[#f2f3ff]">
              <p className="text-sm text-[#727687]">등록된 댓글이 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-20 z-[60] px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-[28px] border border-[#e5e9ff] bg-white px-3 py-3 shadow-[0_18px_48px_rgba(25,27,36,0.12)]">
          <div className="flex-1 rounded-2xl bg-[#f2f3ff] px-4 py-3">
            <div className="mb-1 text-[11px] font-semibold text-[#727687]">댓글 쓰기</div>
            <input
              type="text"
              placeholder="책임 있는 댓글을 입력해주세요"
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              className="w-full bg-transparent text-sm text-[#191b24] outline-none placeholder:text-[#727687]"
            />
          </div>
          <button
            disabled={!commentInput.trim() || isCommentSubmitting}
            onClick={async () => {
              const content = commentInput.trim();

              if (!content) {
                return;
              }

              setIsCommentSubmitting(true);
              try {
                const updated = await api.community.createComment(post.id, { content });
                setPost(updated);
                setCommentInput("");
                setErrorMessage(null);
              } catch (error) {
                console.error("Failed to create comment:", error);
                if (error instanceof ApiClientError) {
                  setErrorMessage(error.message);
                } else {
                  setErrorMessage("댓글을 등록하지 못했습니다.");
                }
              } finally {
                setIsCommentSubmitting(false);
              }
            }}
            className="mb-1 rounded-full bg-[#0066ff] p-3 text-white shadow-lg transition-transform active:scale-90 disabled:cursor-not-allowed disabled:bg-[#b6c7ee] disabled:shadow-none"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
