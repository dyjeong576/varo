import { redirect } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { getServerSession } from "@/lib/auth/session";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  if (!session.profileComplete) {
    redirect("/onboarding/profile");
  }

  return <MainShell>{children}</MainShell>;
}
