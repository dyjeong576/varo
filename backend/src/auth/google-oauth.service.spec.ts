import { GoogleOAuthService } from "./google-oauth.service";

describe("GoogleOAuthService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
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
      SESSION_TTL_DAYS: "30",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("authorize URL에 계산된 redirect_uri를 넣는다", () => {
    const service = new GoogleOAuthService();
    const authorizeUrl = new URL(service.buildAuthorizeUrl("state-token"));

    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:4000/api/v1/auth/google/callback",
    );
  });

  it("토큰 교환 요청에도 동일한 redirect_uri를 사용한다", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          expires_in: 3600,
          scope: "openid email profile",
          token_type: "Bearer",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "google-sub",
          email: "user@example.com",
          email_verified: true,
          name: "VARO User",
        }),
      } as Response);

    const service = new GoogleOAuthService();

    await service.exchangeCodeForUser("google-auth-code");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );

    const tokenRequestBody = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;

    expect(tokenRequestBody.get("redirect_uri")).toBe(
      "http://localhost:4000/api/v1/auth/google/callback",
    );
  });
});
