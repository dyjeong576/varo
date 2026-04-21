"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/http";
import type { CommunityCategory } from "@/lib/types/community";
import { PostEditorForm } from "../_components/post-editor-form";

export default function WritePostPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePublish = async (payload: {
    category: CommunityCategory;
    title: string;
    content: string;
  }) => {
    setIsSubmitting(true);
    try {
      const created = await api.community.createPost(payload);
      router.replace(`/community/${created.id}`);
      router.refresh();
    } catch (error) {
      console.error("Failed to publish post:", error);
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("게시글을 등록하지 못했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PostEditorForm
      mode="create"
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      onSubmit={handlePublish}
    />
  );
}
