import { PopularService } from "./popular.service";

describe("PopularService", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-04T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    const prisma = {
      answerJob: {
        findMany: jest.fn(),
      },
      userHistory: {
        findMany: jest.fn(),
      },
    };

    return {
      prisma,
      service: new PopularService(prisma as never),
    };
  }

  it("submitted와 reopened를 합산해 인기 점수와 추세를 계산한다", async () => {
    const { prisma, service } = createService();
    prisma.answerJob.findMany.mockResolvedValue([
      ...buildAnswerJobs({
        topic: "테슬라 한국 철수",
        count: 6,
        startHour: 0,
      }),
      buildAnswerJob({
        id: "tesla-prev-1",
        createdAt: "2026-04-03T09:00:00.000Z",
        coreCheck: "테슬라 한국 철수",
      }),
      buildAnswerJob({
        id: "tesla-prev-2",
        createdAt: "2026-04-03T08:00:00.000Z",
        coreCheck: "테슬라 한국 철수",
      }),
    ]);
    prisma.userHistory.findMany.mockResolvedValue([
      ...buildReopenEvents({
        answerId: "테슬라 한국 철수-6",
        topic: "테슬라 한국 철수",
        count: 4,
        startHour: 6,
      }),
      buildReopenEvent({
        answerId: "tesla-prev-2",
        topic: "테슬라 한국 철수",
        createdAt: "2026-04-03T07:00:00.000Z",
      }),
    ]);

    const result = await service.listTopics();

    expect(result).toEqual([
      {
        topicKey: "테슬라 한국 철수",
        topicText: "테슬라 한국 철수",
        rank: 1,
        popularityScore: 10,
        answerCount: 6,
        reopenCount: 4,
        trend: "up",
        trendValue: 233.3,
        representativeAnswerId: "테슬라 한국 철수-6",
        updatedAt: "2026-04-04T09:00:00.000Z",
      },
    ]);
  });

  it("coreCheck이 없으면 normalized check을 fallback으로 쓰고 handoff 없는 이벤트는 제외한다", async () => {
    const { prisma, service } = createService();
    prisma.answerJob.findMany.mockResolvedValue([
      ...buildAnswerJobs({
        topic: "트럼프 관세 발표",
        count: 8,
        startHour: 0,
        queryRefinement: null,
      }),
      buildAnswerJob({
        id: "fallback-excluded",
        createdAt: "2026-04-04T08:30:00.000Z",
        normalizedText: "트럼프 관세 발표",
        queryRefinement: null,
        handoffPayload: null,
      }),
    ]);
    prisma.userHistory.findMany.mockResolvedValue([
      buildReopenEvent({
        answerId: "트럼프 관세 발표-8",
        topic: "트럼프 관세 발표",
        createdAt: "2026-04-04T10:00:00.000Z",
        queryRefinement: null,
      }),
      buildReopenEvent({
        answerId: "fallback-excluded",
        topic: "트럼프 관세 발표",
        createdAt: "2026-04-04T11:00:00.000Z",
        queryRefinement: null,
        handoffPayload: null,
      }),
      buildReopenEvent({
        answerId: "fallback-excluded-2",
        topic: "트럼프 관세 발표",
        createdAt: "2026-04-04T09:00:00.000Z",
        queryRefinement: null,
      }),
    ]);

    const result = await service.listTopics();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      topicKey: "트럼프 관세 발표",
      topicText: "트럼프 관세 발표",
      popularityScore: 10,
      answerCount: 8,
      reopenCount: 2,
    });
  });

  it("합산 점수가 10 미만인 topic은 노출하지 않는다", async () => {
    const { prisma, service } = createService();
    prisma.answerJob.findMany.mockResolvedValue([
      ...buildAnswerJobs({
        topic: "9점 topic",
        count: 7,
        startHour: 0,
      }),
    ]);
    prisma.userHistory.findMany.mockResolvedValue([
      ...buildReopenEvents({
        answerId: "9점 topic-7",
        topic: "9점 topic",
        count: 2,
        startHour: 7,
      }),
    ]);

    const result = await service.listTopics();

    expect(result).toEqual([]);
  });

  it("합산 점수, submitted 수, updatedAt 순으로 정렬한다", async () => {
    const { prisma, service } = createService();
    prisma.answerJob.findMany.mockResolvedValue([
      ...buildAnswerJobs({
        topic: "A 주제",
        count: 7,
        startHour: 0,
      }),
      ...buildAnswerJobs({
        topic: "B 주제",
        count: 6,
        startHour: 0,
      }),
      ...buildAnswerJobs({
        topic: "C 주제",
        count: 6,
        startHour: 0,
      }),
    ]);
    prisma.userHistory.findMany.mockResolvedValue([
      ...buildReopenEvents({
        answerId: "A 주제-7",
        topic: "A 주제",
        count: 3,
        startHour: 7,
      }),
      ...buildReopenEvents({
        answerId: "B 주제-6",
        topic: "B 주제",
        count: 4,
        startHour: 6,
      }),
      ...buildReopenEvents({
        answerId: "C 주제-6",
        topic: "C 주제",
        count: 4,
        startHour: 1,
      }),
    ]);

    const result = await service.listTopics();

    expect(result.map((topic) => topic.topicKey)).toEqual(["A 주제", "B 주제", "C 주제"]);
    expect(result[0]).toMatchObject({ popularityScore: 10, answerCount: 7 });
    expect(result[1]).toMatchObject({ popularityScore: 10, answerCount: 6 });
    expect(result[2]).toMatchObject({ popularityScore: 10, answerCount: 6 });
    expect(result[1].updatedAt).toBe("2026-04-04T09:00:00.000Z");
    expect(result[2].updatedAt).toBe("2026-04-04T05:00:00.000Z");
  });
});

function buildAnswerJob(params: {
  id: string;
  createdAt: string;
  coreCheck?: string | null;
  normalizedText?: string;
  queryRefinement?: unknown;
  handoffPayload?: unknown;
}) {
  const queryRefinement =
    params.queryRefinement === undefined
      ? params.coreCheck
        ? { coreCheck: params.coreCheck }
        : null
      : params.queryRefinement;

  return {
    id: params.id,
    createdAt: new Date(params.createdAt),
    queryRefinement,
    handoffPayload:
      params.handoffPayload === undefined
        ? { sourceIds: ["source-1"] }
        : params.handoffPayload,
    check: {
      normalizedText: params.normalizedText ?? params.coreCheck ?? "기본 check",
    },
  };
}

function buildAnswerJobs(params: {
  topic: string;
  count: number;
  startHour: number;
  queryRefinement?: unknown;
}) {
  return Array.from({ length: params.count }, (_, index) =>
    buildAnswerJob({
      id: `${params.topic}-${index + 1}`,
      createdAt: `2026-04-04T${String(params.startHour + index).padStart(2, "0")}:00:00.000Z`,
      coreCheck: params.queryRefinement === null ? undefined : params.topic,
      normalizedText: params.topic,
      queryRefinement: params.queryRefinement,
    }),
  );
}

function buildReopenEvent(params: {
  answerId: string;
  topic: string;
  createdAt: string;
  queryRefinement?: unknown;
  handoffPayload?: unknown;
}) {
  return {
    createdAt: new Date(params.createdAt),
    answerJob: buildAnswerJob({
      id: params.answerId,
      createdAt: params.createdAt,
      coreCheck: params.queryRefinement === null ? undefined : params.topic,
      normalizedText: params.topic,
      queryRefinement: params.queryRefinement,
      handoffPayload: params.handoffPayload,
    }),
  };
}

function buildReopenEvents(params: {
  answerId: string;
  topic: string;
  count: number;
  startHour: number;
}) {
  return Array.from({ length: params.count }, (_, index) =>
    buildReopenEvent({
      answerId: params.answerId,
      topic: params.topic,
      createdAt: `2026-04-04T${String(params.startHour + index).padStart(2, "0")}:00:00.000Z`,
    }),
  );
}
