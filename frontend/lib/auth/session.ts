import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api/http";
import type { SessionResponse } from "@/lib/api/types";

const GUEST_SESSION: SessionResponse = {
  isAuthenticated: false,
  expiresAt: null,
  profileComplete: false,
  user: null,
  profile: null,
};

export async function getServerSession(): Promise<SessionResponse> {
  const cookieStore = await cookies();
  const serverApiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim() || API_BASE_URL;

  try {
    const response = await fetch(`${serverApiBaseUrl}/api/v1/auth/session`, {
      headers: {
        cookie: cookieStore.toString(),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return GUEST_SESSION;
    }

    return (await response.json()) as SessionResponse;
  } catch {
    return GUEST_SESSION;
  }
}
