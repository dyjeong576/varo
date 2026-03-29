import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("세션이 없으면 비로그인 응답을 반환한다", async () => {
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.getSessionResponse(null);

    expect(result).toEqual({
      isAuthenticated: false,
      expiresAt: null,
      profileComplete: false,
      user: null,
      profile: null,
    });
  });
});
