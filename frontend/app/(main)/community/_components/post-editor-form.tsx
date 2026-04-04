"use client";

import { useState } from "react";
import type { CommunityCategory } from "@/lib/types/community";
import { CategorySelector } from "../write/_components/category-selector";
import { WriteHeader } from "../write/_components/write-header";

interface PostEditorFormProps {
  mode: "create" | "edit";
  initialCategory?: CommunityCategory | null;
  initialTitle?: string;
  initialContent?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: {
    category: CommunityCategory;
    title: string;
    content: string;
  }) => Promise<void> | void;
}

export function PostEditorForm({
  mode,
  initialCategory = null,
  initialTitle = "",
  initialContent = "",
  isSubmitting = false,
  errorMessage = null,
  onSubmit,
}: PostEditorFormProps) {
  const [category, setCategory] = useState<CommunityCategory | null>(initialCategory);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  const isPublishDisabled =
    !category || !title.trim() || !content.trim() || isSubmitting;

  const handlePublish = async () => {
    if (!category || isPublishDisabled) {
      return;
    }

    await onSubmit({
      category,
      title: title.trim(),
      content: content.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <WriteHeader
        title={mode === "create" ? "글쓰기" : "글 수정"}
        submitLabel={mode === "create" ? "등록" : "수정"}
        onPublish={handlePublish}
        isPublishDisabled={isPublishDisabled}
      />

      <main className="mx-auto w-full max-w-4xl px-4 pb-32 pt-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-[#eef1ff] bg-white shadow-[0_18px_48px_rgba(25,27,36,0.06)]">
          <CategorySelector selectedCategory={category} onSelect={setCategory} />

          <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
            <div className="border-b border-[#f2f3ff] pb-3">
              <input
                type="text"
                placeholder="제목을 입력하세요"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full border-none bg-transparent text-2xl font-bold text-[#191b24] outline-none placeholder:text-[#ced2e0]"
              />
            </div>

            <div className="min-h-[360px]">
              <textarea
                placeholder="VARO 커뮤니티는 객관적인 근거를 기반으로 한 토론을 환영합니다. 주장을 뒷받침할 링크나 데이터를 함께 공유해주시면 더욱 좋습니다."
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-[360px] w-full resize-none border-none bg-transparent text-[16px] leading-relaxed text-[#191b24] outline-none placeholder:text-[#ced2e0]"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-[#ffd7d7] bg-[#fff6f6] px-4 py-3 text-sm text-[#b42318]">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-20 z-40 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-2xl border border-[#edf0ff] bg-white/95 px-4 py-3 text-[12px] text-[#727687] shadow-[0_12px_32px_rgba(25,27,36,0.08)] backdrop-blur-md">
          <span className="w-1.5 h-1.5 bg-[#0066ff] rounded-full animate-pulse" />
          로그인된 실명 정보로 게시글이 작성됩니다.
        </div>
      </footer>
    </div>
  );
}
