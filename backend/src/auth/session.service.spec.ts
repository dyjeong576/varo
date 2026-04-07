import { SessionService } from "./session.service";

describe("SessionService", () => {
  const createService = (overrides?: Record<string, unknown>) =>
    new SessionService({} as never, {
      get: (key: string, defaultValue?: unknown) => overrides?.[key] ?? defaultValue,
    } as never);

  it("필수 필드가 모두 있으면 profileComplete=true", () => {
    const service = createService();

    expect(
      service.getProfileComplete({
        realName: "홍길동",
        gender: "남성",
        ageRange: "30대",
        country: "대한민국",
        city: "서울특별시",
      } as never),
    ).toBe(true);
  });

  it("필수 필드가 하나라도 없으면 profileComplete=false", () => {
    const service = createService();

    expect(
      service.getProfileComplete({
        realName: "홍길동",
        gender: "남성",
        ageRange: null,
        country: "대한민국",
        city: "서울특별시",
      } as never),
    ).toBe(false);
  });

  it("SESSION_COOKIE_DOMAIN이 있으면 세션 쿠키에 domain을 포함한다", () => {
    const service = createService({
      APP_ENV: "prod",
      SESSION_COOKIE_NAME: "varo_session",
      SESSION_COOKIE_DOMAIN: "varocheck.com",
    });
    const response = {
      cookie: jest.fn(),
    };

    service.writeSessionCookie(response as never, "session-id", new Date("2026-04-08T00:00:00.000Z"));

    expect(response.cookie).toHaveBeenCalledWith(
      "varo_session",
      "session-id",
      expect.objectContaining({
        domain: "varocheck.com",
        secure: true,
        sameSite: "lax",
        httpOnly: true,
      }),
    );
  });

  it("추론된 sessionCookieDomain 설정도 세션 쿠키에 반영한다", () => {
    const service = createService({
      APP_ENV: "prod",
      SESSION_COOKIE_NAME: "varo_session",
      sessionCookieDomain: "varocheck.com",
    });
    const response = {
      cookie: jest.fn(),
    };

    service.writeSessionCookie(response as never, "session-id", new Date("2026-04-08T00:00:00.000Z"));

    expect(response.cookie).toHaveBeenCalledWith(
      "varo_session",
      "session-id",
      expect.objectContaining({
        domain: "varocheck.com",
      }),
    );
  });

  it("SESSION_COOKIE_DOMAIN이 없으면 host-only 세션 쿠키를 유지한다", () => {
    const service = createService({
      APP_ENV: "prod",
      SESSION_COOKIE_NAME: "varo_session",
    });
    const response = {
      cookie: jest.fn(),
    };

    service.writeSessionCookie(response as never, "session-id", new Date("2026-04-08T00:00:00.000Z"));

    expect(response.cookie).toHaveBeenCalledWith(
      "varo_session",
      "session-id",
      expect.not.objectContaining({
        domain: expect.anything(),
      }),
    );
  });
});
