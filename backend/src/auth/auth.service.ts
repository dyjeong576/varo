import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleOAuthService } from "./google-oauth.service";
import { SessionService } from "./session.service";
import { AppException } from "../common/exceptions/app-exception";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { SessionResponseDto } from "./dto/session-response.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly sessionService: SessionService,
  ) {}

  createGoogleAuthFlow(redirectTo?: string): { stateToken: string; authorizeUrl: string } {
    const stateToken = this.googleOAuthService.createStateToken(redirectTo);

    return {
      stateToken,
      authorizeUrl: this.googleOAuthService.buildAuthorizeUrl(stateToken),
    };
  }

  async handleGoogleCallback(params: {
    code?: string;
    stateToken: string;
    stateCookie?: string;
  }): Promise<{
    sessionId: string;
    expiresAt: Date;
    redirectTo: string;
  }> {
    const { code, stateToken, stateCookie } = params;

    if (!stateCookie || stateCookie !== stateToken) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "로그인 검증 정보가 일치하지 않습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!code) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "구글 인증 코드가 없습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = this.googleOAuthService.validateStateToken(stateToken);
    const googleUser = await this.googleOAuthService.exchangeCodeForUser(code);

    const user = await this.prisma.user.upsert({
      where: {
        email: googleUser.email,
      },
      update: {
        displayName: googleUser.name ?? googleUser.email,
      },
      create: {
        email: googleUser.email,
        displayName: googleUser.name ?? googleUser.email,
        authProvider: "google",
        profile: {
          create: {},
        },
      },
      include: {
        profile: true,
      },
    });

    if (!user.profile) {
      await this.prisma.userProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    const session = await this.sessionService.createSession(user.id, googleUser.sub);

    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      redirectTo: payload.redirectTo,
    };
  }

  async getSessionResponse(sessionId?: string | null): Promise<SessionResponseDto> {
    if (!sessionId) {
      return this.buildGuestSession();
    }

    const resolved = await this.sessionService.resolveSession(sessionId);

    if (!resolved) {
      return this.buildGuestSession();
    }

    return {
      isAuthenticated: true,
      expiresAt: resolved.session.expiresAt.toISOString(),
      profileComplete: this.sessionService.getProfileComplete(resolved.profile),
      user: resolved.user,
      profile: resolved.profile
        ? {
            realName: resolved.profile.realName,
            gender: resolved.profile.gender,
            ageRange: resolved.profile.ageRange,
            country: resolved.profile.country,
            city: resolved.profile.city,
          }
        : null,
    };
  }

  private buildGuestSession(): SessionResponseDto {
    return {
      isAuthenticated: false,
      expiresAt: null,
      profileComplete: false,
      user: null,
      profile: null,
    };
  }
}
