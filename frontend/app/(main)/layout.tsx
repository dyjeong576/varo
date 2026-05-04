import { MainShell } from "@/components/layout/main-shell";
import { getServerSession } from "@/lib/auth/session";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return <MainShell session={session}>{children}</MainShell>;
}
