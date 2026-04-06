import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("DB ping가 성공하면 ok 상태를 반환한다", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    };
    const service = new HealthService(prisma as never);

    const result = await service.getHealth();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ok");
    expect(result.service).toBe("backend");
    expect(result.database).toBe(true);
    expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt);
  });
});
