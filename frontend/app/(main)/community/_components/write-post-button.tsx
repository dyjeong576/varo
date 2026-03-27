import React from 'react';
import { Edit3 } from 'lucide-react';
import Link from 'next/link';

export default function WritePostButton() {
  return (
    <div className="flex justify-end">
      <Link 
        href="/community/write"
        className="flex items-center gap-2 bg-[#0066ff] text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 active:scale-95 transition-all"
      >
        <Edit3 className="w-5 h-5" />
        <span>글쓰기</span>
      </Link>
    </div>
  );
}
