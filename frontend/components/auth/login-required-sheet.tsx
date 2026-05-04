"use client";

import Link from "next/link";

interface LoginRequiredSheetProps {
  featureName: string | null;
  onClose: () => void;
}

export function LoginRequiredSheet({ featureName, onClose }: LoginRequiredSheetProps) {
  if (!featureName) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
        className="fixed inset-x-0 bottom-0 z-[130] rounded-t-2xl bg-white px-6 pb-8 pt-6 shadow-[0_-16px_40px_rgba(25,27,36,0.18)]"
      >
        <p className="text-xs font-semibold text-primary">{featureName}</p>
        <h2 id="login-required-title" className="mt-2 text-xl font-bold tracking-normal text-gray-900">
          로그인이 필요한 기능입니다
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          계정 전용 기능은 로그인 후 이용할 수 있습니다.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700"
          >
            닫기
          </button>
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white"
          >
            Google 계정으로 시작하기
          </Link>
        </div>
      </div>
    </>
  );
}
