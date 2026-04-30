import { HeadlinesPageClient } from "@/components/headlines/HeadlinesPageClient";

export const metadata = {
  title: "오늘의 헤드라인 | VARO",
  description: "정치·경제 RSS 헤드라인을 날짜별로 확인하세요.",
};

export default function HeadlinesPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-32 pt-8 lg:max-w-7xl lg:px-8">
      <HeadlinesPageClient />
    </main>
  );
}
