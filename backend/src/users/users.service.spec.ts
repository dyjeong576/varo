import { HttpStatus } from "@nestjs/common";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  it("첫 로그인인데 필수 필드가 빠지면 예외를 던진다", async () => {
    const service = new UsersService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: "user-1",
            email: "test@example.com",
            displayName: "홍길동",
            authProvider: "google",
            profile: {
              userId: "user-1",
              realName: null,
              gender: null,
              ageRange: null,
              country: null,
              city: null,
            },
          }),
        },
      } as never,
      {
        getProfileComplete: jest.fn().mockReturnValue(false),
      } as never,
    );

    await expect(
      service.updateProfile("user-1", {
        country: "대한민국",
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });
});
