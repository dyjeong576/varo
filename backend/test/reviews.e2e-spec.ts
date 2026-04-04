import { ReviewsController } from "../src/reviews/reviews.controller";
import { ReviewsService } from "../src/reviews/reviews.service";
import { ConfigService } from "@nestjs/config";

describe("ReviewsController (e2e)", () => {
  it("query processing preview 요청을 서비스에 위임한다", async () => {
    const reviewsService = {
      createQueryProcessingPreview: jest.fn().mockResolvedValue({
        reviewId: "review-1",
        claimId: "claim-1",
        rawClaim: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
        createdAt: "2026-04-01T02:00:00.000Z",
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
        clientRequestId: "pending:review-1",
      },
    );

    expect(result.reviewId).toBe("review-1");
    expect(reviewsService.createQueryProcessingPreview).toHaveBeenCalledWith("user-1", {
      claim: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
      clientRequestId: "pending:review-1",
    });
  });

  it("dev 환경에서는 테스트용 무인증 API를 허용한다", async () => {
    const reviewsService = {
      createTestQueryProcessingPreview: jest.fn().mockResolvedValue({
        reviewId: "review-1",
        claimId: "claim-1",
        rawClaim: "테슬라가 한국에서 완전 철수한대",
        createdAt: "2026-04-01T02:00:00.000Z",
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

  it("review preview 목록 조회를 서비스에 위임한다", async () => {
    const reviewsService = {
      listQueryProcessingPreviews: jest.fn().mockResolvedValue([
        {
          reviewId: "review-1",
          rawClaim: "트럼프가 오늘 관세 발표했대",
          status: "partial",
          currentStage: "handoff_ready",
          createdAt: "2026-04-01T02:00:00.000Z",
          selectedSourceCount: 1,
          lastErrorCode: null,
        },
      ]),
    } as unknown as ReviewsService;
    const configService = {} as ConfigService;
    const controller = new ReviewsController(reviewsService, configService);

    const result = await controller.listQueryProcessingPreviews({
      user: {
        id: "user-1",
      },
    });

    expect(result).toHaveLength(1);
    expect(reviewsService.listQueryProcessingPreviews).toHaveBeenCalledWith("user-1");
  });

  it("review preview 상세 조회를 서비스에 위임한다", async () => {
    const reviewsService = {
      getQueryProcessingPreview: jest.fn().mockResolvedValue({
        reviewId: "review-1",
        claimId: "claim-1",
        rawClaim: "트럼프가 오늘 관세 발표했대",
        createdAt: "2026-04-01T02:00:00.000Z",
        status: "partial",
        currentStage: "handoff_ready",
        normalizedClaim: "트럼프가 오늘 관세 발표했대",
        claimLanguageCode: "ko",
        languageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
        generatedQueries: [],
        sources: [],
        evidenceSnippets: [],
        searchedSourceCount: 0,
        selectedSourceCount: 0,
        discardedSourceCount: 0,
        handoff: {
          coreClaim: "트럼프의 관세 발표",
          sourceIds: [],
          snippetIds: [],
          insufficiencyReason: null,
        },
      }),
    } as unknown as ReviewsService;
    const configService = {} as ConfigService;
    const controller = new ReviewsController(reviewsService, configService);

    const result = await controller.getQueryProcessingPreview(
      {
        user: {
          id: "user-1",
        },
      },
      "review-1",
    );

    expect(result.reviewId).toBe("review-1");
    expect(reviewsService.getQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      "review-1",
    );
  });

  it("review preview 재진입 기록을 서비스에 위임한다", async () => {
    const reviewsService = {
      recordReviewReopen: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as ReviewsService;
    const configService = {} as ConfigService;
    const controller = new ReviewsController(reviewsService, configService);

    const result = await controller.recordReviewReopen(
      {
        user: {
          id: "user-1",
        },
      },
      "review-1",
      {
        source: "popular",
      },
    );

    expect(result).toEqual({ ok: true });
    expect(reviewsService.recordReviewReopen).toHaveBeenCalledWith(
      "user-1",
      "review-1",
      {
        source: "popular",
      },
    );
  });
});
