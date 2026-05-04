import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function UserInfoLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  return children;
}
