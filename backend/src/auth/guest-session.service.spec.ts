import { HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { GuestSessionService } from "./guest-session.service";

describe("GuestSessionService", () => {
  it("게스트 일일 answer 생성 횟수가 20회 이상이면 차단한다", async () => {
    const prisma = {
      guestSession: {
        findUnique: jest.fn().mockResolvedValue({
          dailyAnswerCount: 20,
          dailyQuotaDate: new Date(Date.now() + 9 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        }),
        update: jest.fn(),
      },
    };
    const configService = {
      get: jest.fn(),
    } as unknown as ConfigService;
    const service = new GuestSessionService(prisma as never, configService);

    await expect(service.consumeAnswerQuota("guest-user-1")).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: APP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    });
    expect(prisma.guestSession.update).not.toHaveBeenCalled();
  });
});
