import { randomBytes, createHash } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { PrismaService } from "../prisma/prisma.service";

const GUEST_COOKIE_NAME = "varo_guest";
const GUEST_TTL_DAYS = 30;
const GUEST_DAILY_ANSWER_LIMIT = 20;

@Injectable()
export class GuestSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async resolveGuestToken(token: string | undefined): Promise<{ userId: string } | null> {
    if (!token) {
      return null;
    }

    const tokenHash = this.hashToken(token);
    const guestSession = await this.prisma.guestSession.findUnique({
      where: { tokenHash },
      select: {
        userId: true,
        expiresAt: true,
      },
    });

    if (!guestSession) {
      return null;
    }

    if (guestSession.expiresAt <= new Date()) {
      await this.prisma.guestSession.deleteMany({
        where: { tokenHash },
      });
      return null;
    }

    return { userId: guestSession.userId };
  }

  async createGuestSession(response: Response): Promise<{ userId: string }> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
    const guestUser = await this.prisma.user.create({
      data: {
        email: `guest-${randomBytes(16).toString("hex")}@guest.varo.local`,
        displayName: "Guest",
        authProvider: "guest",
        guestSession: {
          create: {
            tokenHash,
            expiresAt,
            dailyQuotaDate: this.getTodayKey(),
          },
        },
      },
      select: {
        id: true,
      },
    });

    response.cookie(this.getCookieName(), token, {
      ...this.getCookieOptions(),
      expires: expiresAt,
    });

    return { userId: guestUser.id };
  }

  async consumeAnswerQuota(userId: string): Promise<void> {
    const todayKey = this.getTodayKey();
    const guestSession = await this.prisma.guestSession.findUnique({
      where: { userId },
      select: {
        dailyAnswerCount: true,
        dailyQuotaDate: true,
      },
    });

    if (!guestSession) {
      return;
    }

    const currentCount =
      guestSession.dailyQuotaDate === todayKey ? guestSession.dailyAnswerCount : 0;

    if (currentCount >= GUEST_DAILY_ANSWER_LIMIT) {
      throw new AppException(
        APP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        "비로그인 사용자의 일일 answer 생성 횟수를 초과했습니다.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.guestSession.update({
      where: { userId },
      data: {
        dailyQuotaDate: todayKey,
        dailyAnswerCount: currentCount + 1,
      },
    });
  }

  clearGuestCookie(response: Response): void {
    response.clearCookie(this.getCookieName(), this.getCookieOptions());
  }

  getCookieName(): string {
    return this.configService.get<string>("GUEST_COOKIE_NAME", GUEST_COOKIE_NAME);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private getTodayKey(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private getCookieOptions(): CookieOptions {
    const domain =
      this.configService.get<string>("sessionCookieDomain") ??
      this.configService.get<string>("SESSION_COOKIE_DOMAIN");

    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.configService.get<string>("APP_ENV") === "prod",
      path: "/",
      ...(domain ? { domain } : {}),
    };
  }
}
