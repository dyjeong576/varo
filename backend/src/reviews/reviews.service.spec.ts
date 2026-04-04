import { ReviewsQueryPreviewService } from "./query-preview/reviews-query-preview.service";
import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  it("query processing preview 요청을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn().mockResolvedValue({ reviewId: "review-1" }),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      recordReviewReopen: jest.fn(),
    } as unknown as ReviewsQueryPreviewService;
    const service = new ReviewsService(queryPreviewService);

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "테슬라가 한국에서 철수한대",
      clientRequestId: "pending:review-1",
    });

    expect(result).toEqual({ reviewId: "review-1" });
    expect(queryPreviewService.createQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      {
        claim: "테슬라가 한국에서 철수한대",
        clientRequestId: "pending:review-1",
      },
    );
  });

  it("test query processing preview 요청을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest
        .fn()
        .mockResolvedValue({ reviewId: "review-1" }),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      recordReviewReopen: jest.fn(),
    } as unknown as ReviewsQueryPreviewService;
    const service = new ReviewsService(queryPreviewService);

    const result = await service.createTestQueryProcessingPreview({
      claim: "테슬라가 한국에서 철수한대",
    });

    expect(result).toEqual({ reviewId: "review-1" });
    expect(queryPreviewService.createTestQueryProcessingPreview).toHaveBeenCalledWith({
      claim: "테슬라가 한국에서 철수한대",
    });
  });

  it("review preview 목록 조회를 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest
        .fn()
        .mockResolvedValue([{ reviewId: "review-1" }]),
      getQueryProcessingPreview: jest.fn(),
      recordReviewReopen: jest.fn(),
    } as unknown as ReviewsQueryPreviewService;
    const service = new ReviewsService(queryPreviewService);

    const result = await service.listQueryProcessingPreviews("user-1");

    expect(result).toEqual([{ reviewId: "review-1" }]);
    expect(queryPreviewService.listQueryProcessingPreviews).toHaveBeenCalledWith(
      "user-1",
    );
  });

  it("review preview 상세 조회를 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest
        .fn()
        .mockResolvedValue({ reviewId: "review-1" }),
      recordReviewReopen: jest.fn(),
    } as unknown as ReviewsQueryPreviewService;
    const service = new ReviewsService(queryPreviewService);

    const result = await service.getQueryProcessingPreview("user-1", "review-1");

    expect(result).toEqual({ reviewId: "review-1" });
    expect(queryPreviewService.getQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      "review-1",
    );
  });

  it("review preview 재진입 기록을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      recordReviewReopen: jest.fn().mockResolvedValue(undefined),
    } as unknown as ReviewsQueryPreviewService;
    const service = new ReviewsService(queryPreviewService);

    const result = await service.recordReviewReopen("user-1", "review-1", {
      source: "popular",
    });

    expect(result).toEqual({ ok: true });
    expect(queryPreviewService.recordReviewReopen).toHaveBeenCalledWith(
      "user-1",
      "review-1",
    );
  });
});
