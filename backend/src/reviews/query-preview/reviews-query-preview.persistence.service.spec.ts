import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";
import { ReviewsQueryPreviewPersistenceService } from "./reviews-query-preview.persistence.service";

describe("ReviewsQueryPreviewPersistenceService", () => {
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
    },
    sourceDomainRegistry: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      upsert: jest.fn().mockResolvedValue({
        id: "preview-user-1",
      }),
    },
  });

  it("source와 evidence를 저장하고 review job handoff 상태를 업데이트한다", async () => {
    const prisma = createPrismaMock();
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

    const result = await service.persistQueryPreviewResult({
      reviewJob: { id: "review-1" },
      refinement: {
        claimLanguageCode: "ko",
        coreClaim: "트럼프의 관세 발표",
        generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
        topicScope: "foreign",
        topicCountryCode: "US",
        countryDetectionReason: "미국 이슈로 판단했습니다.",
      },
      generatedQueries: [{ id: "q1", text: "트럼프 관세 발표", rank: 1 }],
      userCountryCode: "KR",
      relevanceCandidates: [
        {
          id: "c1",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: null,
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
        },
      ],
      extractionTargets: [
        {
          id: "c1",
          sourceType: "news",
          publisherName: "Reuters",
          publishedAt: null,
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          originalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          rawTitle: "Trump tariff announcement update",
          rawSnippet: "원문 검증 보도입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          sourceCountryCode: "US",
          retrievalBucket: "verification",
          domainRegistryId: "us-verification",
          relevanceTier: "primary",
          relevanceReason: "원문 검증 source입니다.",
        },
      ],
      extractedSources: [
        {
          canonicalUrl: "https://www.reuters.com/world/us/trump-tariff-update",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ],
      primaryExtractionLimit: 5,
    });

    expect(prisma.source.create).toHaveBeenCalledTimes(1);
    expect(prisma.evidenceSnippet.create).toHaveBeenCalledTimes(1);
    expect(prisma.reviewJob.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
      data: expect.objectContaining({
        status: "partial",
        currentStage: "handoff_ready",
        searchedSourceCount: 1,
        processedSourceCount: 1,
        lastErrorCode: null,
      }),
    });
    expect(result.handoffSourceIds).toEqual(["trump-tariff-update"]);
  });

  it("preview search에 필요한 국가/role만 domain registry에서 조회한다", async () => {
    const prisma = createPrismaMock();
    prisma.sourceDomainRegistry.findMany.mockResolvedValue([
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
    ]);
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);

    const result = await service.loadSearchDomainRegistry({
      userCountryCode: "KR",
      topicCountryCode: "US",
    });

    expect(prisma.sourceDomainRegistry.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        usageRole: {
          in: [
            "familiar_news",
            "verification_official",
            "verification_news",
            "global_reference",
          ],
        },
        countryCode: {
          in: ["KR", "US", "GLOBAL"],
        },
      },
      orderBy: [{ priority: "asc" }, { countryCode: "asc" }],
    });
    expect(result).toEqual([
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
    ]);
  });

  it("app exception을 review job failed 상태로 기록한다", async () => {
    const prisma = createPrismaMock();
    const service = new ReviewsQueryPreviewPersistenceService(prisma as never);
    const error = new AppException(
      APP_ERROR_CODES.LLM_SCHEMA_ERROR,
      "질의 정제 실패",
      HttpStatus.BAD_GATEWAY,
    );

    await service.markReviewJobFailed("review-1", error);

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
