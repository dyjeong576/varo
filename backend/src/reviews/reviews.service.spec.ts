import { ReviewsQueryPreviewService } from "./query-preview/reviews-query-preview.service";
import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  it("query processing preview 요청을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn().mockResolvedValue({ reviewId: "review-1" }),
      createTestQueryProcessingPreview: jest.fn(),
    } as unknown as ReviewsQueryPreviewService;
    const service = new ReviewsService(queryPreviewService);

    const result = await service.createQueryProcessingPreview("user-1", {
      claim: "테슬라가 한국에서 철수한대",
    });

    expect(result).toEqual({ reviewId: "review-1" });
    expect(queryPreviewService.createQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      { claim: "테슬라가 한국에서 철수한대" },
    );
  });

  it("test query processing preview 요청을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest
        .fn()
        .mockResolvedValue({ reviewId: "review-1" }),
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
});
