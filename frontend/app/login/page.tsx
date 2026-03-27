import Image from "next/image";

export const metadata = {
  title: "로그인 - Verifi",
  description: "Verifi에 로그인하여 진실을 검토해보세요.",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 py-8">
      {/* 화면 중앙 메인 영역 (flex-1은 아니고 전체 중앙 정렬) */}
      <div className="flex w-full max-w-sm flex-col items-center justify-center flex-1">
        {/* 서비스 타이틀 */}
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-blue-600">
          Verifi
        </h1>

        {/* 서비스 카피 */}
        <p className="mb-12 text-center text-lg text-gray-600 break-keep">
          진실을 향한 가장 빠른 발걸음, 베리파이
        </p>

        {/* 단일 구글 로그인 CTA */}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-full border border-gray-300 bg-white px-6 py-3.5 text-base font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {/* 구글 아이콘 (인라인 SVG) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            className="flex-shrink-0"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google 계정으로 시작하기
        </button>
      </div>

      {/* 하단 약관 및 카피라이트 */}
      <div className="w-full max-w-sm shrink-0">
        <p className="mb-4 text-center text-xs leading-relaxed text-gray-500 break-keep">
          로그인 시 Verifi의 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
        <p className="text-center text-xs text-gray-400">
          &copy; 2024 Verifi. The Digital Curator.
        </p>
      </div>
    </main>
  );
}
