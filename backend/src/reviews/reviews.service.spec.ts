import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  const createPrismaMock = () => ({
    claim: {
      create: jest.fn().mockResolvedValue({
        id: "claim-1",
      }),
    },
    reviewJob: {
      create: jest.fn().mockResolvedValue({
        id: "review-1",
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    source: {
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: `${String(data.canonicalUrl).split("/").pop()}`,
            ...data,
          }),
        ),
    },
    evidenceSnippet: {
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: `snippet-${String(data.sourceId)}`,
            ...data,
          }),
        ),
    },
    userProfile: {
      findUnique: jest.fn().mockResolvedValue({
        country: "KR",
      }),
      create: jest.fn().mockResolvedValue(undefined),
    },
    sourceDomainRegistry: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "kr-familiar",
          domain: "yna.co.kr",
          countryCode: "KR",
          languageCode: "ko",
          sourceKind: "news_agency",
          usageRole: "familiar_news",
          priority: 10,
          isActive: true,
        },
        {
          id: "us-verification",
          domain: "reuters.com",
          countryCode: "US",
          languageCode: "en",
          sourceKind: "news_agency",
          usageRole: "verification_news",
          priority: 20,
          isActive: true,
        },
      ]),
    },
    user: {
      upsert: jest.fn().mockResolvedValue({
        id: "preview-user-1",
      }),
    },
  });

  it("빈 claim이면 입력 검증 예외를 던진다", async () => {
    const service = new ReviewsService(createPrismaMock() as never, {} as never);

    await expect(
      service.createQueryProcessingPreview("user-1", {
        claim: "   ",
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it("country-aware query processing preview를 저장하고 응답 메타데이터를 반환한다", async () => {
    const prisma = createPrismaMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason:
          "미국 대통령과 관세 정책 단서가 확인되어 미국 이슈로 판단했습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([
        {
          id: "c1",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: "2026-04-01T00:00:00.000Z",
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 관련 한국 보도",
          rawSnippet: "국내 종합 기사입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          sourceCountryCode: "KR",
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
        {
          id: "c2",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: "2026-04-01T01:00:00.000Z",
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-2",
          originQueryIds: ["q2"],
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
        },
      ]),
      searchFallbackSources: jest.fn().mockResolvedValue([]),
      applyRelevanceFiltering: jest
        .fn()
        .mockImplementation(async ({ candidates }) =>
          candidates.map((candidate: Record<string, unknown>) => ({
            ...candidate,
            relevanceTier:
              candidate.retrievalBucket === "verification" ? "primary" : "reference",
            relevanceReason:
              candidate.retrievalBucket === "verification"
                ? "원문 검증 source입니다."
                : "국내 친숙형 보도로 보조 근거입니다.",
          })),
        ),
      extractContent: jest.fn().mockResolvedValue([
        {
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ]),
    };
    const service = new ReviewsService(prisma as never, providers as never);

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
    });

    expect(result.reviewId).toBe("review-1");
    expect(result.claimLanguageCode).toBe("ko");
    expect(result.topicScope).toBe("foreign");
    expect(result.topicCountryCode).toBe("US");
    expect(result.countryDetectionReason).toContain("미국");
    expect(result.generatedQueries).toHaveLength(3);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]?.retrievalBucket).toBe("familiar");
    expect(result.sources[1]?.retrievalBucket).toBe("verification");
    expect(result.sources[1]?.domainRegistryMatched).toBe(true);
    expect(result.evidenceSnippets).toHaveLength(1);
    expect(prisma.userProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { country: true },
    });
    expect(providers.searchSources).toHaveBeenCalledWith(
      expect.objectContaining({
        userCountryCode: "KR",
        topicCountryCode: "US",
      }),
    );
  });

  it("verification source가 부족하면 fallback search를 수행한다", async () => {
    const prisma = createPrismaMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [
          { id: "q1", text: "트럼프 관세 발표", rank: 1 },
          { id: "q2", text: "Trump tariff announcement", rank: 2 },
          { id: "q3", text: "미국 관세 정책 발표", rank: 3 },
        ],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
      }),
      searchSources: jest.fn().mockResolvedValue([
        {
          id: "c1",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: null,
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          rawTitle: "트럼프 관세 발표 관련 한국 보도",
          rawSnippet: "국내 종합 기사입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          sourceCountryCode: "KR",
          retrievalBucket: "familiar",
          domainRegistryId: "kr-familiar",
        },
      ]),
      searchFallbackSources: jest.fn().mockResolvedValue([
        {
          id: "c2",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: null,
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-2",
          originQueryIds: ["q2"],
          sourceCountryCode: "US",
          retrievalBucket: "fallback",
          domainRegistryId: "us-verification",
        },
      ]),
      applyRelevanceFiltering: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: "c1",
            sourceType: "news",
            publisherName: "연합뉴스",
            publishedAt: null,
            canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
            originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
            rawTitle: "트럼프 관세 발표 관련 한국 보도",
            rawSnippet: "국내 종합 기사입니다.",
            normalizedHash: "hash-1",
            originQueryIds: ["q1"],
            sourceCountryCode: "KR",
            retrievalBucket: "familiar",
            domainRegistryId: "kr-familiar",
            relevanceTier: "reference",
            relevanceReason: "보조 근거입니다.",
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "c1",
            sourceType: "news",
            publisherName: "연합뉴스",
            publishedAt: null,
            canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
            originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
            rawTitle: "트럼프 관세 발표 관련 한국 보도",
            rawSnippet: "국내 종합 기사입니다.",
            normalizedHash: "hash-1",
            originQueryIds: ["q1"],
            sourceCountryCode: "KR",
            retrievalBucket: "familiar",
            domainRegistryId: "kr-familiar",
            relevanceTier: "reference",
            relevanceReason: "보조 근거입니다.",
          },
          {
            id: "c2",
            sourceType: "news",
            publisherName: "Reuters",
            publishedAt: null,
            canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
            originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
            rawTitle: "Trump tariff announcement update",
            rawSnippet: "원문 검증 보도입니다.",
            normalizedHash: "hash-2",
            originQueryIds: ["q2"],
            sourceCountryCode: "US",
            retrievalBucket: "fallback",
            domainRegistryId: "us-verification",
            relevanceTier: "primary",
            relevanceReason: "fallback으로 확보한 검증 source입니다.",
          },
        ]),
      extractContent: jest.fn().mockResolvedValue([
        {
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ]),
    };
    const service = new ReviewsService(prisma as never, providers as never);

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "트럼프가 오늘 관세 발표했대",
    });

    expect(providers.searchFallbackSources).toHaveBeenCalledTimes(1);
    expect(result.sources.some((source) => source.retrievalBucket === "fallback")).toBe(true);
  });

  it("refinement가 실패해도 claim은 남기고 review job을 failed로 기록한다", async () => {
    const prisma = createPrismaMock();
    const providers = {
      refineQuery: jest.fn().mockRejectedValue(
        new AppException(
          APP_ERROR_CODES.LLM_SCHEMA_ERROR,
          "질의 정제 결과가 요구 형식을 충족하지 않습니다.",
          HttpStatus.BAD_GATEWAY,
        ),
      ),
    };
    const service = new ReviewsService(prisma as never, providers as never);

    await expect(
      service.createQueryProcessingPreview("user-1", {
        claim: "테슬라가 한국에서 완전 철수한대",
      }),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      status: HttpStatus.BAD_GATEWAY,
    });

    expect(prisma.claim.create).toHaveBeenCalledTimes(1);
    expect(prisma.reviewJob.create).toHaveBeenCalledTimes(1);
    expect(prisma.reviewJob.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
      data: {
        status: "failed",
        currentStage: "failed",
        lastErrorCode: APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      },
    });
  });
});
