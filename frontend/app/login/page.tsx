import Link from "next/link";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/http";
import { getServerSession } from "@/lib/auth/session";

export const metadata = {
  title: "로그인 - VARO",
  description: "VARO에 로그인하여 근거 기반 검토를 시작하세요.",
};

export default async function LoginPage() {
  const session = await getServerSession();

  if (session.isAuthenticated) {
    redirect(session.profileComplete ? "/" : "/onboarding/profile");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 py-8">
      <div className="flex w-full max-w-sm flex-col items-center justify-center flex-1">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-blue-600">
          VARO
        </h1>

        <p className="mb-12 text-center text-lg text-gray-600 break-keep">
          수집된 출처를 바탕으로 판단의 맥락을 정리합니다
        </p>

        <Link
          href={`${API_BASE_URL}/api/v1/auth/google`}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-gray-300 bg-white px-6 py-3.5 text-base font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
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
        </Link>
      </div>

      <div className="w-full max-w-sm shrink-0">
        <p className="mb-4 text-center text-xs leading-relaxed text-gray-500 break-keep">
          로그인 시 VARO의 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
        <p className="text-center text-xs text-gray-400">
          &copy; 2024 VARO.
        </p>
      </div>
    </main>
  );
}
