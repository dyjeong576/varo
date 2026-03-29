import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileOnboardingForm } from "@/components/auth/profile-onboarding-form";
import { getServerSession } from "@/lib/auth/session";
import { APP_NAME, APP_TAGLINE } from "@/lib/config/app";
import { buildPageMetadata } from "@/lib/config/metadata";

export const metadata: Metadata = buildPageMetadata(
  "프로필 온보딩",
  `${APP_NAME} 프로필을 설정하고 ${APP_TAGLINE} 경험을 시작하세요.`,
);

export default async function OnboardingProfilePage() {
  const session = await getServerSession();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  if (session.profileComplete) {
    redirect("/");
  }

  return (
    <main className="min-h-[100dvh] bg-[linear-gradient(180deg,#eef5ff_0%,#ffffff_40%,#f8fbff_100%)] px-6 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-4 text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#0050cb] uppercase">{APP_TAGLINE}</p>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">프로필 정보를 먼저 완성해 주세요</h1>
          <p className="mx-auto max-w-2xl break-keep text-[15px] leading-7 text-gray-600">
            {APP_NAME}는 커뮤니티와 분석 이력을 하나의 계정 체계로 연결합니다. 첫 로그인에서는 실명, 성별, 나이대, 활동 지역을 입력해야 {APP_TAGLINE} 경험을 시작할 수 있습니다.
          </p>
        </div>

        <ProfileOnboardingForm />
      </div>
    </main>
  );
}
