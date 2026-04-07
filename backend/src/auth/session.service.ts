import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { CookieOptions } from "express";
import type { UserProfile } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface ResolvedSession {
  session: {
    id: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    displayName: string | null;
    authProvider: string;
  };
  profile: UserProfile | null;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(userId: string, providerSubject: string): Promise<{ id: string; expiresAt: Date }> {
    const ttlDays = this.configService.get<number>("SESSION_TTL_DAYS", 30);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        providerSubject,
        expiresAt,
      },
    });

    return {
      id: session.id,
      expiresAt: session.expiresAt,
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
      },
    });
  }

  async resolveSession(sessionId: string): Promise<ResolvedSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt <= new Date()) {
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        authProvider: session.user.authProvider,
      },
      profile: session.user.profile,
    };
  }

  getProfileComplete(profile: UserProfile | null | undefined): boolean {
    if (!profile) {
      return false;
    }

    return Boolean(
      profile.realName &&
        profile.gender &&
        profile.ageRange &&
        profile.country &&
        profile.city,
    );
  }

  writeSessionCookie(response: Response, sessionId: string, expiresAt: Date): void {
    response.cookie(this.getCookieName(), sessionId, {
      ...this.getSessionCookieOptions(),
      expires: expiresAt,
    });
  }

  writeOauthStateCookie(response: Response, token: string): void {
    response.cookie(this.getOauthStateCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.configService.get<string>("APP_ENV") === "prod",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(this.getCookieName(), {
      ...this.getSessionCookieOptions(),
    });
  }

  clearOauthStateCookie(response: Response): void {
    response.clearCookie(this.getOauthStateCookieName(), {
      httpOnly: true,
      sameSite: "lax",
      secure: this.configService.get<string>("APP_ENV") === "prod",
      path: "/",
    });
  }

  getCookieName(): string {
    return this.configService.get<string>("SESSION_COOKIE_NAME", "varo_session");
  }

  getOauthStateCookieName(): string {
    return `${this.getCookieName()}_oauth_state`;
  }

  private getSessionCookieOptions(): CookieOptions {
    const domain = this.configService.get<string>("SESSION_COOKIE_DOMAIN");

    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.configService.get<string>("APP_ENV") === "prod",
      path: "/",
      ...(domain ? { domain } : {}),
    };
  }
}
