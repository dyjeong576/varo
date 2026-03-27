import React from 'react';
import { Shield } from 'lucide-react';

export default function TrustBanner() {
  return (
    <section className="bg-[#b3c5ff]/10 rounded-xl p-4 flex items-start gap-3 border border-[#0050cb]/5">
      <Shield className="text-[#0050cb] w-5 h-5 mt-0.5 flex-shrink-0" />
      <p className="text-sm font-medium text-[#424656] leading-relaxed">
        베리파이 커뮤니티는 책임 있는 토론을 지향합니다. 익명 게시글 작성은 허용되지 않습니다.
      </p>
    </section>
  );
}
