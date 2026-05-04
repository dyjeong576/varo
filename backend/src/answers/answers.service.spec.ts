import { AnswersQueryPreviewService } from "./query-preview/answers-query-preview.service";
import { AnswersProvidersService } from "./answers.providers.service";
import { AnswersService } from "./answers.service";

describe("AnswersService", () => {
  const actor = { userId: "user-1", kind: "authenticated" as const };
  const createProvidersServiceMock = () =>
    ({
      searchNaverNewsForTest: jest.fn(),
    }) as unknown as AnswersProvidersService;
  const createGuestSessionServiceMock = () =>
    ({
      consumeAnswerQuota: jest.fn(),
    }) as { consumeAnswerQuota: jest.Mock };

  it("query processing preview 요청을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn().mockResolvedValue({ answerId: "answer-1" }),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      deleteQueryProcessingPreview: jest.fn(),
      recordAnswerReopen: jest.fn(),
    } as unknown as AnswersQueryPreviewService;
    const service = new AnswersService(
      queryPreviewService,
      createProvidersServiceMock(),
      createGuestSessionServiceMock() as never,
    );

    const result = await service.createQueryProcessingPreview(actor, {
      check: "테슬라가 한국에서 철수한대",
      clientRequestId: "pending:answer-1",
    });

    expect(result).toEqual({ answerId: "answer-1" });
    expect(queryPreviewService.createQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      {
        check: "테슬라가 한국에서 철수한대",
        clientRequestId: "pending:answer-1",
      },
    );
  });

  it("게스트 answer 생성은 일일 quota를 먼저 소비한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn().mockResolvedValue({ answerId: "answer-1" }),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      deleteQueryProcessingPreview: jest.fn(),
      recordAnswerReopen: jest.fn(),
    } as unknown as AnswersQueryPreviewService;
    const guestSessionService = createGuestSessionServiceMock();
    const service = new AnswersService(
      queryPreviewService,
      createProvidersServiceMock(),
      guestSessionService as never,
    );
    const guestActor = { userId: "guest-user-1", kind: "guest" as const };

    await service.createQueryProcessingPreview(guestActor, {
      check: "한국 경제 뉴스 확인",
    });

    expect(guestSessionService.consumeAnswerQuota).toHaveBeenCalledWith("guest-user-1");
    expect(queryPreviewService.createQueryProcessingPreview).toHaveBeenCalledWith(
      "guest-user-1",
      {
        check: "한국 경제 뉴스 확인",
      },
    );
  });

  it("test query processing preview 요청을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest
        .fn()
        .mockResolvedValue({ answerId: "answer-1" }),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      deleteQueryProcessingPreview: jest.fn(),
      recordAnswerReopen: jest.fn(),
    } as unknown as AnswersQueryPreviewService;
    const service = new AnswersService(
      queryPreviewService,
      createProvidersServiceMock(),
      createGuestSessionServiceMock() as never,
    );

    const result = await service.createTestQueryProcessingPreview({
      check: "테슬라가 한국에서 철수한대",
    });

    expect(result).toEqual({ answerId: "answer-1" });
    expect(queryPreviewService.createTestQueryProcessingPreview).toHaveBeenCalledWith({
      check: "테슬라가 한국에서 철수한대",
    });
  });

  it("answer preview 목록 조회를 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest
        .fn()
        .mockResolvedValue([{ answerId: "answer-1" }]),
      getQueryProcessingPreview: jest.fn(),
      deleteQueryProcessingPreview: jest.fn(),
      recordAnswerReopen: jest.fn(),
    } as unknown as AnswersQueryPreviewService;
    const service = new AnswersService(
      queryPreviewService,
      createProvidersServiceMock(),
      createGuestSessionServiceMock() as never,
    );

    const result = await service.listQueryProcessingPreviews(actor);

    expect(result).toEqual([{ answerId: "answer-1" }]);
    expect(queryPreviewService.listQueryProcessingPreviews).toHaveBeenCalledWith(
      "user-1",
    );
  });

  it("answer preview 상세 조회를 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest
        .fn()
        .mockResolvedValue({ answerId: "answer-1" }),
      deleteQueryProcessingPreview: jest.fn(),
      recordAnswerReopen: jest.fn(),
    } as unknown as AnswersQueryPreviewService;
    const service = new AnswersService(
      queryPreviewService,
      createProvidersServiceMock(),
      createGuestSessionServiceMock() as never,
    );

    const result = await service.getQueryProcessingPreview(actor, "answer-1");

    expect(result).toEqual({ answerId: "answer-1" });
    expect(queryPreviewService.getQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      "answer-1",
    );
  });

  it("answer preview 삭제를 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      deleteQueryProcessingPreview: jest.fn().mockResolvedValue(undefined),
      recordAnswerReopen: jest.fn(),
    } as unknown as AnswersQueryPreviewService;
    const service = new AnswersService(
      queryPreviewService,
      createProvidersServiceMock(),
      createGuestSessionServiceMock() as never,
    );

    const result = await service.deleteQueryProcessingPreview(actor, "answer-1");

    expect(result).toEqual({ ok: true });
    expect(queryPreviewService.deleteQueryProcessingPreview).toHaveBeenCalledWith(
      "user-1",
      "answer-1",
    );
  });

  it("answer preview 재진입 기록을 query preview service에 위임한다", async () => {
    const queryPreviewService = {
      createQueryProcessingPreview: jest.fn(),
      createTestQueryProcessingPreview: jest.fn(),
      listQueryProcessingPreviews: jest.fn(),
      getQueryProcessingPreview: jest.fn(),
      deleteQueryProcessingPreview: jest.fn(),
      recordAnswerReopen: jest.fn().mockResolvedValue(undefined),
    } as unknown as AnswersQueryPreviewService;
    const service = new AnswersService(
      queryPreviewService,
      createProvidersServiceMock(),
      createGuestSessionServiceMock() as never,
    );

    const result = await service.recordAnswerReopen(actor, "answer-1", {
      source: "popular",
    });

    expect(result).toEqual({ ok: true });
    expect(queryPreviewService.recordAnswerReopen).toHaveBeenCalledWith(
      "user-1",
      "answer-1",
    );
  });

  it("Naver 뉴스 검색 테스트 요청을 providers service에 위임한다", async () => {
    const queryPreviewService = {} as AnswersQueryPreviewService;
    const providersService = {
      searchNaverNewsForTest: jest.fn().mockResolvedValue([
        {
          id: "naver-c1",
          sourceType: "news",
          publisherName: "연합뉴스",
          publishedAt: "2026-04-01T00:00:00.000Z",
          canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
          originalUrl: "https://n.news.naver.com/mnews/article/001/0010000001",
          rawTitle: "테슬라 한국 철수설",
          rawSnippet: "기사 설명",
          normalizedHash: "hash-1",
          originQueryIds: ["q1"],
          retrievalBucket: "familiar",
          domainRegistryId: "kr-centrist-yna",
        },
      ]),
    } as unknown as AnswersProvidersService;
    const service = new AnswersService(
      queryPreviewService,
      providersService,
      createGuestSessionServiceMock() as never,
    );

    const result = await service.searchNaverNewsForTest({
      query: " 테슬라 한국 철수 ",
    });

    expect(result.query).toBe("테슬라 한국 철수");
    expect(result.display).toBe(5);
    expect(result.start).toBe(1);
    expect(result.sort).toBe("sim");
    expect(result.items[0]).toMatchObject({
      id: "naver-c1",
      relevanceTier: "reference",
      domainRegistryMatched: true,
      stance: "unknown",
    });
    expect(providersService.searchNaverNewsForTest).toHaveBeenCalledWith({
      query: "테슬라 한국 철수",
      display: 5,
      start: 1,
      sort: "sim",
    });
  });
});
