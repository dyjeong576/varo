import { HttpStatus, Injectable } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { URLSearchParams } from "node:url";
import { AppException } from "../common/exceptions/app-exception";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { getAppConfig } from "../config/app.config";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

interface StatePayload {
  nonce: string;
  redirectTo: string;
  issuedAt: number;
}

@Injectable()
export class GoogleOAuthService {
  private readonly config = getAppConfig();

  createStateToken(redirectTo?: string): string {
    const payload: StatePayload = {
      nonce: randomBytes(12).toString("hex"),
      redirectTo: this.sanitizeRedirectTo(redirectTo),
      issuedAt: Date.now(),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.sign(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  validateStateToken(token: string): StatePayload {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature || this.sign(encodedPayload) !== signature) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "로그인 상태 검증에 실패했습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as StatePayload;

    if (Date.now() - payload.issuedAt > 10 * 60 * 1000) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "로그인 시도가 만료되었습니다. 다시 시도해 주세요.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return payload;
  }

  buildAuthorizeUrl(state: string): string {
    const query = new URLSearchParams({
      client_id: this.config.googleClientId,
      redirect_uri: this.config.googleCallbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
  }

  async exchangeCodeForUser(code: string): Promise<GoogleUserInfo> {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        redirect_uri: this.config.googleCallbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "구글 토큰 교환에 실패했습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "구글 사용자 정보 조회에 실패했습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

    if (!userInfo.email_verified) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "이메일 인증이 완료된 구글 계정만 사용할 수 있습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return userInfo;
  }

  private sanitizeRedirectTo(redirectTo?: string): string {
    if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
      return "/";
    }

    return redirectTo;
  }

  private sign(value: string): string {
    return createHmac("sha256", this.config.sessionSecret).update(value).digest("base64url");
  }
}
