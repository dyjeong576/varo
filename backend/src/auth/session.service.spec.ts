import { SessionService } from "./session.service";

describe("SessionService", () => {
  it("필수 필드가 모두 있으면 profileComplete=true", () => {
    const service = new SessionService({} as never, {
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    } as never);

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
    const service = new SessionService({} as never, {
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    } as never);

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
});
