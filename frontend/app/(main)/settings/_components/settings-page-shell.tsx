import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface SettingsPageShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function SettingsPageShell({
  title,
  description,
  children,
}: SettingsPageShellProps) {
  return (
    <div className="min-h-full bg-[#faf8ff]">
      <div className="sticky top-0 z-10 border-b border-[#c2c6d8]/15 bg-[#faf8ff]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link
            href="/settings"
            className="rounded-full p-2 -ml-2 text-[#424656] transition-colors hover:bg-[#e6e7f4]"
            aria-label="설정으로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#191b24]">{title}</h1>
            <p className="mt-0.5 text-sm text-[#6b7280]">{description}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-6 pb-24">
        {children}
      </main>
    </div>
  );
}
