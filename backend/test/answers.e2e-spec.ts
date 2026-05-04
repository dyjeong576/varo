import { AnswersController } from "../src/answers/answers.controller";
import { AnswersService } from "../src/answers/answers.service";
import { ConfigService } from "@nestjs/config";

describe("AnswersController (e2e)", () => {
  const actor = { userId: "user-1", kind: "authenticated" as const };

  it("query processing preview 요청을 서비스에 위임한다", async () => {
    const answersService = {
      createQueryProcessingPreview: jest.fn().mockResolvedValue({
        answerId: "answer-1",
        clientRequestId: "pending:answer-1",
        checkId: "check-1",
        rawCheck: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
        createdAt: "2026-04-01T02:00:00.000Z",
        status: "partial",
        currentStage: "handoff_ready",
        normalizedCheck: "테슬라가 한국에서 완전 철수한대",
        coreCheck: "테슬라의 한국 시장 철수",
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
          coreCheck: "테슬라의 한국 시장 철수",
          sourceIds: [],
          snippetIds: [],
          insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
        },
      }),
    } as unknown as AnswersService;
    const configService = {} as ConfigService;
    const controller = new AnswersController(answersService, configService);

    const result = await controller.createQueryProcessingPreview(
      actor,
      {
        check: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
        clientRequestId: "pending:answer-1",
      },
    );

    expect(result.answerId).toBe("answer-1");
    expect(result.clientRequestId).toBe("pending:answer-1");
    expect(answersService.createQueryProcessingPreview).toHaveBeenCalledWith(actor, {
      check: "나 어제 뉴스에서 봤는데 테슬라가 한국에서 완전 철수한대",
      clientRequestId: "pending:answer-1",
    });
  });

  it("dev 환경에서는 테스트용 무인증 API를 허용한다", async () => {
    const answersService = {
      createTestQueryProcessingPreview: jest.fn().mockResolvedValue({
        answerId: "answer-1",
        clientRequestId: null,
        checkId: "check-1",
        rawCheck: "테슬라가 한국에서 완전 철수한대",
        createdAt: "2026-04-01T02:00:00.000Z",
        status: "partial",
        currentStage: "handoff_ready",
        normalizedCheck: "테슬라가 한국에서 완전 철수한대",
        coreCheck: "테슬라의 한국 시장 철수",
        generatedQueries: [
],
        sources: [],
        evidenceSnippets: [],
        searchedSourceCount: 0,
        selectedSourceCount: 0,
        discardedSourceCount: 0,
        handoff: {
          coreCheck: "테슬라의 한국 시장 철수",
          sourceIds: [],
          snippetIds: [],
          insufficiencyReason: null,
        },
      }),
    } as unknown as AnswersService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "dev";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new AnswersController(answersService, configService);

    const result = await controller.createTestQueryProcessingPreview({
      check: "테슬라가 한국에서 완전 철수한대",
    });

    expect(result.answerId).toBe("answer-1");
    expect(answersService.createTestQueryProcessingPreview).toHaveBeenCalledWith({
      check: "테슬라가 한국에서 완전 철수한대",
    });
  });

  it("dev 환경에서는 Naver 뉴스 검색 테스트 API를 허용한다", async () => {
    const answersService = {
      searchNaverNewsForTest: jest.fn().mockResolvedValue({
        query: "테슬라 한국 철수",
        display: 5,
        start: 1,
        sort: "sim",
        items: [],
      }),
    } as unknown as AnswersService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "dev";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new AnswersController(answersService, configService);

    const result = await controller.searchNaverNewsForTest({
      query: "테슬라 한국 철수",
    });

    expect(result.query).toBe("테슬라 한국 철수");
    expect(answersService.searchNaverNewsForTest).toHaveBeenCalledWith({
      query: "테슬라 한국 철수",
    });
  });

  it("prod 환경에서는 테스트용 무인증 API를 차단한다", async () => {
    const answersService = {} as AnswersService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "prod";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new AnswersController(answersService, configService);

    await expect(
      controller.createTestQueryProcessingPreview({
        check: "테슬라가 한국에서 완전 철수한대",
      }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("prod 환경에서는 Naver 뉴스 검색 테스트 API를 차단한다", async () => {
    const answersService = {} as AnswersService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "prod";
        }

        return undefined;
      }),
    } as unknown as ConfigService;
    const controller = new AnswersController(answersService, configService);

    await expect(
      controller.searchNaverNewsForTest({
        query: "테슬라 한국 철수",
      }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("answer preview 목록 조회를 서비스에 위임한다", async () => {
    const answersService = {
      listQueryProcessingPreviews: jest.fn().mockResolvedValue([
        {
          answerId: "answer-1",
          clientRequestId: "pending:answer-1",
          rawCheck: "트럼프가 오늘 관세 발표했대",
          status: "partial",
          currentStage: "handoff_ready",
          createdAt: "2026-04-01T02:00:00.000Z",
          selectedSourceCount: 1,
          lastErrorCode: null,
        },
      ]),
    } as unknown as AnswersService;
    const configService = {} as ConfigService;
    const controller = new AnswersController(answersService, configService);

    const result = await controller.listQueryProcessingPreviews(actor);

    expect(result).toHaveLength(1);
    expect(result[0]?.clientRequestId).toBe("pending:answer-1");
    expect(answersService.listQueryProcessingPreviews).toHaveBeenCalledWith(actor);
  });

  it("answer preview 상세 조회를 서비스에 위임한다", async () => {
    const answersService = {
      getQueryProcessingPreview: jest.fn().mockResolvedValue({
        answerId: "answer-1",
        clientRequestId: "pending:answer-1",
        checkId: "check-1",
        rawCheck: "트럼프가 오늘 관세 발표했대",
        createdAt: "2026-04-01T02:00:00.000Z",
        status: "partial",
        currentStage: "handoff_ready",
        normalizedCheck: "트럼프가 오늘 관세 발표했대",
        coreCheck: "트럼프의 관세 발표",
        generatedQueries: [],

        sources: [],
        evidenceSnippets: [],
        searchedSourceCount: 0,
        selectedSourceCount: 0,
        discardedSourceCount: 0,
        handoff: {
          coreCheck: "트럼프의 관세 발표",
          sourceIds: [],
          snippetIds: [],
          insufficiencyReason: null,
        },
      }),
    } as unknown as AnswersService;
    const configService = {} as ConfigService;
    const controller = new AnswersController(answersService, configService);

    const result = await controller.getQueryProcessingPreview(
      actor,
      "answer-1",
    );

    expect(result.answerId).toBe("answer-1");
    expect(result.clientRequestId).toBe("pending:answer-1");
    expect(answersService.getQueryProcessingPreview).toHaveBeenCalledWith(
      actor,
      "answer-1",
    );
  });

  it("answer preview 재진입 기록을 서비스에 위임한다", async () => {
    const answersService = {
      recordAnswerReopen: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as AnswersService;
    const configService = {} as ConfigService;
    const controller = new AnswersController(answersService, configService);

    const result = await controller.recordAnswerReopen(
      actor,
      "answer-1",
      {
        source: "popular",
      },
    );

    expect(result).toEqual({ ok: true });
    expect(answersService.recordAnswerReopen).toHaveBeenCalledWith(
      actor,
      "answer-1",
      {
        source: "popular",
      },
    );
  });
});
