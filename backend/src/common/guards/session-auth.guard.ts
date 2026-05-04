import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { APP_ERROR_CODES } from "../constants/app-error-codes";
import { AppException } from "../exceptions/app-exception";
import type { AuthenticatedRequest } from "../types/authenticated-request";
import { SessionService } from "../../auth/session.service";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const cookieName = this.configService.get<string>("SESSION_COOKIE_NAME", "varo_session");
    const sessionToken = request.cookies?.[cookieName];

    if (!sessionToken) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "로그인이 필요합니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const resolved = await this.sessionService.resolveSession(sessionToken);

    if (!resolved) {
      this.sessionService.clearSessionCookie(response);
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "세션이 만료되었거나 유효하지 않습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

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
}
