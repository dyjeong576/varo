import { ConfigService } from "@nestjs/config";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { SessionService } from "../src/auth/session.service";

describe("AuthController (e2e)", () => {
  const createResponse = () => {
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    return response;
  };

  it("구글 로그인 시작 시 redirect를 반환한다", async () => {
    const authService = {
      createGoogleAuthFlow: jest.fn().mockReturnValue({
        stateToken: "state-token",
        authorizeUrl: "https://accounts.google.com/mock",
      }),
    } as unknown as AuthService;
    const sessionService = {
      writeOauthStateCookie: jest.fn(),
    } as unknown as SessionService;
    const configService = {} as ConfigService;
    const controller = new AuthController(authService, sessionService, configService);
    const response = createResponse();

    await controller.startGoogleLogin("/", response as never);

    expect(sessionService.writeOauthStateCookie).toHaveBeenCalledWith(response, "state-token");
    expect(response.redirect).toHaveBeenCalledWith("https://accounts.google.com/mock");
  });

  it("구글 로그인 콜백 후 프론트 절대 URL로 redirect 한다", async () => {
    const authService = {
      handleGoogleCallback: jest.fn().mockResolvedValue({
        sessionId: "session-id",
        expiresAt: new Date("2026-03-28T00:00:00.000Z"),
        redirectTo: "/onboarding/profile",
      }),
    } as unknown as AuthService;
    const sessionService = {
      getOauthStateCookieName: jest.fn().mockReturnValue("varo_session_oauth_state"),
      clearOauthStateCookie: jest.fn(),
      writeSessionCookie: jest.fn(),
    } as unknown as SessionService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "frontendBaseUrl") {
          return "http://localhost:3000/";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new AuthController(authService, sessionService, configService);
    const response = createResponse();

    await controller.handleGoogleCallback(
      "google-code",
      "state-token",
      {
        cookies: {
          varo_session_oauth_state: "state-token",
        },
      } as never,
      response as never,
    );

    expect(response.redirect).toHaveBeenCalledWith("http://localhost:3000/onboarding/profile");
  });

  it("query string이 있는 내부 경로도 프론트 절대 URL로 redirect 한다", async () => {
    const authService = {
      handleGoogleCallback: jest.fn().mockResolvedValue({
        sessionId: "session-id",
        expiresAt: new Date("2026-03-28T00:00:00.000Z"),
        redirectTo: "/reviews/123?tab=evidence",
      }),
    } as unknown as AuthService;
    const sessionService = {
      getOauthStateCookieName: jest.fn().mockReturnValue("varo_session_oauth_state"),
      clearOauthStateCookie: jest.fn(),
      writeSessionCookie: jest.fn(),
    } as unknown as SessionService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "frontendBaseUrl") {
          return "http://localhost:3000";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new AuthController(authService, sessionService, configService);
    const response = createResponse();

    await controller.handleGoogleCallback(
      "google-code",
      "state-token",
      {
        cookies: {
          varo_session_oauth_state: "state-token",
        },
      } as never,
      response as never,
    );

    expect(response.redirect).toHaveBeenCalledWith("http://localhost:3000/reviews/123?tab=evidence");
  });

  it("루트 경로도 프론트 절대 URL로 redirect 한다", async () => {
    const authService = {
      handleGoogleCallback: jest.fn().mockResolvedValue({
        sessionId: "session-id",
        expiresAt: new Date("2026-03-28T00:00:00.000Z"),
        redirectTo: "/",
      }),
    } as unknown as AuthService;
    const sessionService = {
      getOauthStateCookieName: jest.fn().mockReturnValue("varo_session_oauth_state"),
      clearOauthStateCookie: jest.fn(),
      writeSessionCookie: jest.fn(),
    } as unknown as SessionService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "frontendBaseUrl") {
          return "http://localhost:3000";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new AuthController(authService, sessionService, configService);
    const response = createResponse();

    await controller.handleGoogleCallback(
      "google-code",
      "state-token",
      {
        cookies: {
          varo_session_oauth_state: "state-token",
        },
      } as never,
      response as never,
    );

    expect(response.redirect).toHaveBeenCalledWith("http://localhost:3000/");
  });

  it("세션 조회가 guest payload를 반환한다", async () => {
    const authService = {
      getSessionResponse: jest.fn().mockResolvedValue({
        isAuthenticated: false,
        expiresAt: null,
        profileComplete: false,
        user: null,
        profile: null,
      }),
    } as unknown as AuthService;
    const sessionService = {
      getCookieName: jest.fn().mockReturnValue("varo_session"),
    } as unknown as SessionService;
    const configService = {} as ConfigService;
    const controller = new AuthController(authService, sessionService, configService);

    const result = await controller.getSession({
      cookies: {},
    } as never);

    expect(result.isAuthenticated).toBe(false);
    expect(authService.getSessionResponse).toHaveBeenCalledWith(undefined);
  });
});
