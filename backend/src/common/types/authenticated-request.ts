import type { Request } from "express";
import type { UserProfile } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  authProvider: string;
}

export interface RequestActor {
  userId: string;
  kind: "authenticated" | "guest";
}

export interface AuthenticatedRequest extends Request {
  traceId?: string;
  sessionId?: string;
  sessionExpiresAt?: Date;
  currentUser?: SessionUser;
  currentProfile?: UserProfile | null;
  currentActor?: RequestActor;
}
