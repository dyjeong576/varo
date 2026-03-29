import { UsersController } from "../src/users/users.controller";
import { UsersService } from "../src/users/users.service";

describe("UsersController (e2e)", () => {
  it("현재 사용자 조회 성공", async () => {
    const usersService = {
      getMe: jest.fn().mockResolvedValue({
        user: {
          id: "user-1",
          email: "user@example.com",
          displayName: "홍길동",
          authProvider: "google",
        },
        profile: {
          realName: "홍길동",
          gender: "남성",
          ageRange: "30대",
          country: "대한민국",
          city: "서울특별시",
        },
        profileComplete: true,
      }),
    } as unknown as UsersService;
    const controller = new UsersController(usersService);

    const result = await controller.getMe({
      user: {
        id: "user-1",
      },
    });

    expect(result.user.email).toBe("user@example.com");
    expect(usersService.getMe).toHaveBeenCalledWith("user-1");
  });

  it("프로필 수정 성공", async () => {
    const usersService = {
      updateProfile: jest.fn().mockResolvedValue({
        user: {
          id: "user-1",
          email: "user@example.com",
          displayName: "홍길동",
          authProvider: "google",
        },
        profile: {
          realName: "홍길동",
          gender: "남성",
          ageRange: "30대",
          country: "대한민국",
          city: "부산광역시",
        },
        profileComplete: true,
      }),
    } as unknown as UsersService;
    const controller = new UsersController(usersService);

    const result = await controller.updateMyProfile(
      {
        user: {
          id: "user-1",
        },
      },
      {
        country: "대한민국",
        city: "부산광역시",
      },
    );

    expect(result.profile.city).toBe("부산광역시");
    expect(usersService.updateProfile).toHaveBeenCalledWith("user-1", {
      country: "대한민국",
      city: "부산광역시",
    });
  });
});
