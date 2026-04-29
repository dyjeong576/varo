import { buildFrontendRedirectUrl, buildGoogleCallbackUrl, getAppConfig } from "./app.config";

describe("app.config", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("API_BASE_URL로 구글 콜백 URL을 계산한다", () => {
    expect(buildGoogleCallbackUrl("http://localhost:4000")).toBe(
      "http://localhost:4000/api/v1/auth/google/callback",
    );
  });

  it("API_BASE_URL 끝의 slash를 정규화한다", () => {
    expect(buildGoogleCallbackUrl("http://localhost:4000/")).toBe(
      "http://localhost:4000/api/v1/auth/google/callback",
    );
  });

  it("FRONTEND_BASE_URL로 프론트 절대 리다이렉트 URL을 계산한다", () => {
    expect(buildFrontendRedirectUrl("http://localhost:3000", "/onboarding/profile")).toBe(
      "http://localhost:3000/onboarding/profile",
    );
  });

  it("FRONTEND_BASE_URL 끝의 slash를 정규화한다", () => {
    expect(buildFrontendRedirectUrl("http://localhost:3000/", "/answers/123?tab=evidence")).toBe(
      "http://localhost:3000/answers/123?tab=evidence",
    );
  });

  it("getAppConfig가 정규화된 URL 설정을 노출한다", () => {
    process.env = {
      ...originalEnv,
      PORT: "4000",
      NODE_ENV: "development",
      APP_ENV: "dev",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/varo",
      API_BASE_URL: "http://localhost:4000/",
      FRONTEND_BASE_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      SESSION_SECRET: "session-secret",
      SESSION_COOKIE_NAME: "varo_session",
      SESSION_COOKIE_DOMAIN: "varocheck.com",
      SESSION_TTL_DAYS: "30",
    };

    const config = getAppConfig();

    expect(config.appName).toBe("VARO");
    expect(config.appTagline).toBe("Verified Analysis, Reasoned Opinion");
    expect(config.appPublicUrl).toBeNull();
    expect(config.appIntendedProductionHost).toBe("www.varocheck.com");
    expect(config.appCanonicalHostStatus).toBe("pending");
    expect(config.googleCallbackUrl).toBe("http://localhost:4000/api/v1/auth/google/callback");
    expect(config.frontendBaseUrl).toBe("http://localhost:3000");
    expect(config.sessionCookieDomain).toBe("varocheck.com");
    expect(config.answerProviderMode).toBe("mock");
    expect(config.openAiApiKey).toBeNull();
    expect(config.naverClientId).toBeNull();
    expect(config.naverClientSecret).toBeNull();
    expect(config.naverSearchTimeoutMs).toBe(40000);
    expect(config.tavilyApiKey).toBeNull();
    expect(config.tavilySearchTimeoutMs).toBe(40000);
    expect(config.tavilyExtractTimeoutMs).toBe(180000);
  });

  it("prod에서 www/api 표준 호스트를 쓰면 세션 쿠키 domain을 자동 추론한다", () => {
    process.env = {
      ...originalEnv,
      PORT: "4000",
      NODE_ENV: "production",
      APP_ENV: "prod",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/varo",
      API_BASE_URL: "https://api.varocheck.com",
      FRONTEND_BASE_URL: "https://www.varocheck.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      SESSION_SECRET: "session-secret",
      SESSION_COOKIE_NAME: "varo_session",
      SESSION_TTL_DAYS: "30",
    };

    const config = getAppConfig();

    expect(config.sessionCookieDomain).toBe("varocheck.com");
  });
});
