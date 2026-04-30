import React from 'react';
import { Shield } from 'lucide-react';

export default function TrustBanner() {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-[#0050cb]/5 bg-[#b3c5ff]/10 p-4 lg:p-5">
      <Shield className="text-[#0050cb] w-5 h-5 mt-0.5 flex-shrink-0" />
      <p className="text-sm font-medium text-[#424656] leading-relaxed">
        VARO 커뮤니티에서는 익명 게시글 작성이 불가하며, 존댓말 사용을 원칙으로 합니다.
      </p>
    </section>
  );
}
