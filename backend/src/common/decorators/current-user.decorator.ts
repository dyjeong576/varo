import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../types/authenticated-request";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    return {
      user: request.currentUser,
      profile: request.currentProfile ?? null,
      sessionId: request.sessionId,
      sessionExpiresAt: request.sessionExpiresAt,
    };
  },
);
