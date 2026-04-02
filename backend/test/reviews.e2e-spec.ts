import { ReviewsController } from "../src/reviews/reviews.controller";
import { ReviewsService } from "../src/reviews/reviews.service";
import { ConfigService } from "@nestjs/config";

describe("ReviewsController (e2e)", () => {
  it("query processing preview 요청을 서비스에 위임한다", async () => {
    const reviewsService = {
      createQueryProcessingPreview: jest.fn().mockResolvedValue({
        reviewId: "review-1",
        claimId: "claim-1",
        status: "partial",
        currentStage: "handoff_ready",
        normalizedClaim: "테슬라가 한국에서 완전 철수한대",
        claimLanguageCode: "ko",
        languageCode: "ko",
        coreClaim: "테슬라의 한국 시장 철수",
        topicScope: "domestic",
        topicCountryCode: "KR",
        countryDetectionReason: "한국 관련 표현이 확인되어 국내 이슈로 판단했습니다.",
        generatedQueries: [
          { id: "q1", text: "테슬라 한국 철수", rank: 1 },
          { id: "q2", text: "테슬라 한국 공식 발표", rank: 2 },
          { id: "q3", text: "테슬라 한국 정정 해명", rank: 3 },
        ],
        sources: [],
        evidenceSnippets: [],
        searchedSourceCount: 0,
        selectedSourceCount: 0,
        discardedSourceCount: 0,
        handoff: {
          coreClaim: "테슬라의 한국 시장 철수",
          sourceIds: [],
          snippetIds: [],
          insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
        },
      }),
    } as unknown as ReviewsService;
    const configService = {} as ConfigService;
    const controller = new ReviewsController(reviewsService, configService);

    const result = await controller.createQueryProcessingPreview(
      {
        user: {
          id: "user-1",
        },
      },
      {
        claim: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
      },
    );

    expect(result.reviewId).toBe("review-1");
    expect(reviewsService.createQueryProcessingPreview).toHaveBeenCalledWith("user-1", {
      claim: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
    });
  });

  it("dev 환경에서는 테스트용 무인증 API를 허용한다", async () => {
    const reviewsService = {
      createTestQueryProcessingPreview: jest.fn().mockResolvedValue({
        reviewId: "review-1",
        claimId: "claim-1",
        status: "partial",
        currentStage: "handoff_ready",
        normalizedClaim: "테슬라가 한국에서 완전 철수한대",
        claimLanguageCode: "ko",
        languageCode: "ko",
        coreClaim: "테슬라의 한국 시장 철수",
        topicScope: "domestic",
        topicCountryCode: "KR",
        countryDetectionReason: "한국 관련 표현이 확인되어 국내 이슈로 판단했습니다.",
        generatedQueries: [],
        sources: [],
        evidenceSnippets: [],
        searchedSourceCount: 0,
        selectedSourceCount: 0,
        discardedSourceCount: 0,
        handoff: {
          coreClaim: "테슬라의 한국 시장 철수",
          sourceIds: [],
          snippetIds: [],
          insufficiencyReason: null,
        },
      }),
    } as unknown as ReviewsService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "dev";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new ReviewsController(reviewsService, configService);

    const result = await controller.createTestQueryProcessingPreview({
      claim: "테슬라가 한국에서 완전 철수한대",
    });

    expect(result.reviewId).toBe("review-1");
    expect(reviewsService.createTestQueryProcessingPreview).toHaveBeenCalledWith({
      claim: "테슬라가 한국에서 완전 철수한대",
    });
  });

  it("prod 환경에서는 테스트용 무인증 API를 차단한다", async () => {
    const reviewsService = {} as ReviewsService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "prod";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new ReviewsController(reviewsService, configService);

    await expect(
      controller.createTestQueryProcessingPreview({
        claim: "테슬라가 한국에서 완전 철수한대",
      }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});
