import { PopularController } from "../src/popular/popular.controller";
import { PopularService } from "../src/popular/popular.service";

describe("PopularController (e2e)", () => {
  it("인기 검색 주제 목록 조회를 서비스에 위임한다", async () => {
    const popularService = {
      listTopics: jest.fn().mockResolvedValue([
        {
          topicKey: "테슬라 한국 철수",
          topicText: "테슬라 한국 철수",
          rank: 1,
          popularityScore: 12,
          answerCount: 7,
          reopenCount: 5,
          trend: "up",
          trendValue: 50,
          representativeAnswerId: "answer-1",
          updatedAt: "2026-04-04T10:00:00.000Z",
        },
      ]),
    } as unknown as PopularService;
    const controller = new PopularController(popularService);

    const result = await controller.listTopics();

    expect(result).toHaveLength(1);
    expect(result[0].popularityScore).toBe(12);
    expect(result[0].representativeAnswerId).toBe("answer-1");
    expect(popularService.listTopics).toHaveBeenCalled();
  });
});
