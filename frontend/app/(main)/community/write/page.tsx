"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WriteHeader } from "./_components/write-header";
import { CategorySelector } from "./_components/category-selector";
import { CommunityCategory } from "@/lib/api/types";

export default function WritePostPage() {
  const router = useRouter();
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPublishDisabled = !category || !title.trim() || !content.trim() || isSubmitting;

  const handlePublish = async () => {
    if (isPublishDisabled) return;

    setIsSubmitting(true);
    try {
      // 실제 API 호출 대신 Mock 지연 시간 추가
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // 성공 처리 (실제로는 API 연동 후 결과에 따라 처리)
      router.push("/community");
      router.refresh(); // 홈 피드 갱신 유도
    } catch (error) {
      console.error("Failed to publish post:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white max-w-2xl mx-auto">
      <WriteHeader onPublish={handlePublish} isPublishDisabled={isPublishDisabled} />
      
      <main className="pb-20">
        <CategorySelector selectedCategory={category} onSelect={setCategory} />
        
        <div className="px-4 space-y-6">
          <div className="border-b border-[#f2f3ff] pb-2">
            <input
              type="text"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-2xl font-bold text-[#191b24] placeholder:text-[#ced2e0] outline-none border-none bg-transparent"
            />
          </div>
          
          <div className="min-h-[300px]">
            <textarea
              placeholder="VARO 커뮤니티는 객관적인 근거를 기반으로 한 토론을 환영합니다. 주장을 뒷받침할 링크나 데이터를 함께 공유해주시면 더욱 좋습니다."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full min-h-[300px] text-[16px] text-[#191b24] placeholder:text-[#ced2e0] outline-none border-none bg-transparent resize-none leading-relaxed"
            />
          </div>
        </div>
      </main>

      {/* 실명제 안내 푸터 (간이) */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-[#faf8ff] border-t border-[#f2f3ff] max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-[12px] text-[#727687]">
          <span className="w-1.5 h-1.5 bg-[#0066ff] rounded-full animate-pulse" />
          로그인된 실명 정보로 게시글이 작성됩니다.
        </div>
      </footer>
    </div>
  );
}
