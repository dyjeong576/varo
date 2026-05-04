import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/authenticated-request";
import { GuestSessionService } from "../../auth/guest-session.service";
import { SessionService } from "../../auth/session.service";

@Injectable()
export class SessionOrGuestActorGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly guestSessionService: GuestSessionService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const cookieName = this.configService.get<string>("SESSION_COOKIE_NAME", "varo_session");
    const sessionToken = request.cookies?.[cookieName];

    if (sessionToken) {
      const resolved = await this.sessionService.resolveSession(sessionToken);

      if (resolved) {
        request.sessionId = resolved.session.id;
        request.sessionExpiresAt = resolved.session.expiresAt;
        request.currentActor = {
          userId: resolved.user.id,
          kind: "authenticated",
        };
        request.currentUser = {
          id: resolved.user.id,
          email: resolved.user.email,
          displayName: resolved.user.displayName,
          authProvider: resolved.user.authProvider,
        };
        request.currentProfile = resolved.profile;

        return true;
      }

      this.sessionService.clearSessionCookie(response);
    }

    const guestToken = request.cookies?.[this.guestSessionService.getCookieName()];
    const resolvedGuest =
      (await this.guestSessionService.resolveGuestToken(guestToken)) ??
      (await this.guestSessionService.createGuestSession(response));

    request.currentActor = {
      userId: resolvedGuest.userId,
      kind: "guest",
    };

    return true;
  }
}
