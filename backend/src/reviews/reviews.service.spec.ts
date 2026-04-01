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
  });

  it("빈 claim이면 입력 검증 예외를 던진다", async () => {
    const service = new ReviewsService(
      createPrismaMock() as never,
      {} as never,
    );

    await expect(
      service.createQueryProcessingPreview("user-1", {
        claim: "   ",
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it("query processing preview를 저장하고 handoff payload를 반환한다", async () => {
    const prisma = createPrismaMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        languageCode: "ko",
        coreClaim: "테슬라의 한국 시장 철수",
        generatedQueries: [
          { id: "q1", text: "테슬라 한국 철수", rank: 1 },
          { id: "q2", text: "테슬라 한국 공식 발표", rank: 2 },
          { id: "q3", text: "테슬라 한국 정정 해명", rank: 3 },
        ],
      }),
      searchSources: jest.fn().mockResolvedValue([
        {
          id: "c1",
          sourceType: "official",
          publisherName: "정부부처 보도자료",
          publishedAt: "2026-04-01T00:00:00.000Z",
          canonicalUrl: "https://www.gov.example.kr/press/varo-official",
          originalUrl: "https://www.gov.example.kr/press/varo-official?utm_source=x",
          rawTitle: "테슬라 한국 사업 관련 공식 입장",
          rawSnippet: "공식 설명입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1", "q2"],
          relevanceTier: "primary",
          relevanceReason: "공식 출처입니다.",
        },
        {
          id: "c2",
          sourceType: "analysis",
          publisherName: "해설 매체",
          publishedAt: "2026-04-01T01:00:00.000Z",
          canonicalUrl: "https://analysis.example.com/varo-explainer",
          originalUrl: "https://analysis.example.com/varo-explainer",
          rawTitle: "테슬라 한국 철수 해설",
          rawSnippet: "직접 근거는 약하지만 배경 설명입니다.",
          normalizedHash: "hash-2",
          originQueryIds: ["q3"],
          relevanceTier: "reference",
          relevanceReason: "보조 맥락입니다.",
        },
      ]),
      applyRelevanceFiltering: jest.fn().mockImplementation(async (_coreClaim, candidates) => candidates),
      extractContent: jest.fn().mockResolvedValue([
        {
          canonicalUrl: "https://www.gov.example.kr/press/varo-official",
          contentText: "추출 본문",
          snippetText: "추출 snippet",
        },
      ]),
    };
    const service = new ReviewsService(prisma as never, providers as never);

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
    });

    expect(result.reviewId).toBe("review-1");
    expect(result.claimId).toBe("claim-1");
    expect(result.generatedQueries).toHaveLength(3);
    expect(result.sources).toHaveLength(2);
    expect(result.evidenceSnippets).toHaveLength(1);
    expect(result.evidenceSnippets[0]?.snippetText).toBe("추출 snippet");
    expect(result.handoff.sourceIds).toHaveLength(1);
    expect(prisma.claim.create).toHaveBeenCalledWith({
      data: {
        rawText: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
        normalizedText: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
      },
    });
    expect(prisma.reviewJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "review-1" },
        data: expect.objectContaining({
          status: "partial",
          currentStage: "handoff_ready",
        }),
      }),
    );
  });

  it("중복 source를 canonical URL 기준으로 병합하면서 origin query lineage를 유지한다", async () => {
    const prisma = createPrismaMock();
    const providers = {
      refineQuery: jest.fn().mockResolvedValue({
        languageCode: "ko",
        coreClaim: "테슬라의 한국 시장 철수",
        generatedQueries: [
          { id: "q1", text: "테슬라 한국 철수", rank: 1 },
          { id: "q2", text: "Tesla Korea market exit", rank: 2 },
          { id: "q3", text: "테슬라 한국 영업 중단", rank: 3 },
        ],
      }),
      searchSources: jest.fn().mockResolvedValue([
        {
          id: "c1",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: "2026-04-01T00:00:00.000Z",
          canonicalUrl: "https://news.example.com/articles/varo-core",
          originalUrl: "https://news.example.com/articles/varo-core?utm_source=q1",
          rawTitle: "테슬라 한국 사업 철수 보도",
          rawSnippet: "첫 번째 검색 결과입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
        },
        {
          id: "c2",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: "2026-04-01T01:00:00.000Z",
          canonicalUrl: "https://news.example.com/articles/varo-core",
          originalUrl: "https://news.example.com/articles/varo-core?utm_source=q2",
          rawTitle: "테슬라 한국 사업 철수 보도",
          rawSnippet: "두 번째 검색 결과입니다.",
          normalizedHash: "hash-1",
          originQueryIds: ["q2"],
        },
      ]),
      applyRelevanceFiltering: jest.fn().mockImplementation(async (_coreClaim, candidates) =>
        candidates.map((candidate: { canonicalUrl: string }) => ({
          ...candidate,
          relevanceTier: "primary",
          relevanceReason: "관련 보도입니다.",
        })),
      ),
      extractContent: jest.fn().mockResolvedValue([
        {
          canonicalUrl: "https://news.example.com/articles/varo-core",
          contentText: "추출 본문",
          snippetText: "핵심 스니펫",
        },
      ]),
    };
    const service = new ReviewsService(prisma as never, providers as never);

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "테슬라가 한국에서 완전 철수한대",
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.originQueryIds).toEqual(["q1", "q2"]);
    expect(result.evidenceSnippets[0]?.snippetText).toBe("핵심 스니펫");
    expect(prisma.claim.create).toHaveBeenCalledWith({
      data: {
        rawText: "테슬라가 한국에서 완전 철수한대",
        normalizedText: "테슬라가 한국에서 완전 철수한대",
      },
    });
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
