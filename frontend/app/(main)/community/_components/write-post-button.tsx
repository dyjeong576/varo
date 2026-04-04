import React from 'react';
import { Edit3 } from 'lucide-react';
import Link from 'next/link';

export default function WritePostButton() {
  return (
    <div className="flex justify-end">
      <Link 
        href="/community/write"
        className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
      >
        <Edit3 className="h-4.5 w-4.5" />
        <span>글쓰기</span>
      </Link>
    </div>
  );
}
