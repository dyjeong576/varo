import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  const createController = () => {
    const authService = {
      createGoogleAuthFlow: jest.fn(),
      handleGoogleCallback: jest.fn(),
      getSessionResponse: jest.fn(),
    };
    const sessionService = {
      getOauthStateCookieName: jest.fn().mockReturnValue("varo_oauth_state"),
      clearOauthStateCookie: jest.fn(),
      writeOauthStateCookie: jest.fn(),
      writeSessionCookie: jest.fn(),
      getCookieName: jest.fn(),
      deleteSession: jest.fn(),
      clearSessionCookie: jest.fn(),
    };
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "frontendBaseUrl" || key === "FRONTEND_BASE_URL") {
          return "http://localhost:3000";
        }

        return undefined;
      }),
    };

    return {
      authService,
      sessionService,
      configService,
      controller: new AuthController(
        authService as never,
        sessionService as never,
        configService as unknown as ConfigService,
      ),
    };
  };

  it("구글 로그인 취소 시 로그인 페이지로 리다이렉트한다", async () => {
    const { controller, authService, sessionService } = createController();
    const request = {
      cookies: {
        varo_oauth_state: "state-token",
      },
    } as unknown as Request;
    const response = {
      redirect: jest.fn(),
    } as unknown as Response;

    await controller.handleGoogleCallback(
      undefined,
      "state-token",
      "access_denied",
      request,
      response,
    );

    expect(authService.handleGoogleCallback).not.toHaveBeenCalled();
    expect(sessionService.clearOauthStateCookie).toHaveBeenCalledWith(response);
    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3000/login?authError=google_access_denied",
    );
  });

  it("AUTH_REQUIRED 예외는 로그인 페이지로 리다이렉트한다", async () => {
    const { controller, authService, sessionService } = createController();
    authService.handleGoogleCallback.mockRejectedValue(
      new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "구글 토큰 교환에 실패했습니다.",
        401,
      ),
    );
    const request = {
      cookies: {
        varo_oauth_state: "state-token",
      },
    } as unknown as Request;
    const response = {
      redirect: jest.fn(),
    } as unknown as Response;

    await controller.handleGoogleCallback(
      "google-code",
      "state-token",
      undefined,
      request,
      response,
    );

    expect(sessionService.clearOauthStateCookie).toHaveBeenCalledWith(response);
    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3000/login?authError=google_auth_failed",
    );
  });
});
