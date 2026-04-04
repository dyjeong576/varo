"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import { PostEditorForm } from "../../_components/post-editor-form";
import type { CommunityPostDetail } from "@/lib/types/community";

interface EditCommunityPostPageProps {
  params: Promise<{ postId: string }>;
}

export default function EditCommunityPostPage({ params }: EditCommunityPostPageProps) {
  const { postId } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPost() {
      try {
        const detail = await api.community.getPostDetail(postId);

        if (!detail.isAuthor) {
          setErrorMessage("본인이 작성한 게시글만 수정할 수 있습니다.");
          return;
        }

        setPost(detail);
      } catch (error) {
        console.error("Failed to load post for edit:", error);
        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("게시글 정보를 불러오지 못했습니다.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPost();
  }, [postId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0050cb] border-t-transparent" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-[#424656]">{errorMessage ?? "게시글을 불러오지 못했습니다."}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-full bg-[#f2f3ff] px-4 py-2 text-sm font-semibold text-[#191b24]"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <PostEditorForm
      mode="edit"
      initialCategory={post.category}
      initialTitle={post.title}
      initialContent={post.content}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onSubmit={async (payload) => {
        setIsSubmitting(true);
        try {
          const updated = await api.community.updatePost(postId, payload);
          router.replace(`/community/${updated.id}`);
          router.refresh();
        } catch (error) {
          console.error("Failed to update post:", error);
          if (error instanceof ApiClientError) {
            setErrorMessage(error.message);
          } else {
            setErrorMessage("게시글을 수정하지 못했습니다.");
          }
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}
