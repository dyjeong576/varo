import { EvidenceSnippet, Source } from "@prisma/client";
import { SearchPlan } from "../answers.types";
import { assembleAnswerResult } from "./answer-result-assembler";

function createSource(overrides: Partial<Source>): Source {
  return {
    id: "source-1",
    answerJobId: "answer-1",
    sourceType: "news",
    publisherName: "Reuters",
    publishedAt: new Date("2026-04-01T01:00:00.000Z"),
    canonicalUrl: "https://example.com/source-1",
    originalUrl: "https://example.com/source-1",
    rawTitle: "기본 제목",
    rawSnippet: "기본 스니펫",
    normalizedHash: "hash-1",
    fetchStatus: "fetched",
    contentText: "기본 본문",
    isDuplicate: false,
    duplicateGroupKey: null,
    originQueryIds: ["q1"],
    relevanceTier: "primary",
    relevanceReason: "핵심 근거",
    retrievalBucket: "verification",
    ...overrides,
  } as Source;
}

function createSnippet(overrides: Partial<EvidenceSnippet>): EvidenceSnippet {
  return {
    id: "snippet-1",
    answerJobId: "answer-1",
    sourceId: "source-1",
    snippetText: "기본 snippet",
    stance: "neutral",
    startOffset: null,
    endOffset: null,
    ...overrides,
  };
}

function createSearchPlan(overrides: Partial<SearchPlan> = {}): SearchPlan {
  return {
    queries: [
      { id: "q1", purpose: "check_specific", query: "테슬라 로드스터 2026년 4월 공개", priority: 1 },
      { id: "q2", purpose: "current_state", query: "테슬라 로드스터 출시일", priority: 2 },
      { id: "q3", purpose: "primary_source", query: "Tesla Roadster official announcement", priority: 3 },
      { id: "q4", purpose: "contradiction_or_update", query: "테슬라 로드스터 공개 연기", priority: 4 },
    ],
    ...overrides,
  };
}

describe("assembleAnswerResult", () => {
  it("support 우세인 경우 Likely True를 반환한다", () => {
    const sources = [
      createSource({
        id: "source-1",
        sourceType: "official",
        rawTitle: "서울시 공식 발표",
      }),
      createSource({
        id: "source-2",
        sourceType: "news",
        retrievalBucket: "verification",
        rawTitle: "Reuters verification report",
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
      }),
      createSource({
        id: "source-3",
        sourceType: "analysis",
        retrievalBucket: "familiar",
        relevanceTier: "reference",
        rawTitle: "배경 설명 기사",
        canonicalUrl: "https://example.com/source-3",
        originalUrl: "https://example.com/source-3",
      }),
    ];
    const evidenceSnippets = [
      createSnippet({ id: "snippet-1", sourceId: "source-1" }),
      createSnippet({ id: "snippet-2", sourceId: "source-2" }),
      createSnippet({ id: "snippet-3", sourceId: "source-3" }),
    ];

    const result = assembleAnswerResult({
      coreCheck: "서울시 무제한 교통권 세계 최초",
      rawCheck: "서울시 무제한 교통권 세계 최초래",
      sources,
      evidenceSnippets,
      insufficiencyReason: null,
    });

    expect(result.sourceStances["source-1"]).toBe("support");
    expect(result.result.verdict).toBe("Likely True");
    expect(result.result.consensusLevel).toBe("high");
    expect(result.result.sourceBreakdown.official).toBe(1);
    expect(result.result.agreementCount).toBe(2);
    expect(result.result.contextCount).toBe(1);
    expect(result.result.analysisSummary).toContain(
      '수집된 뉴스들이 "서울시 무제한 교통권 세계 최초"을 뒷받침하고 있습니다.',
    );
    expect(result.result.analysisSummary).toContain(
      "공식 출처에서도 이를 확인했습니다.",
    );
    expect(result.result.analysisSummary).not.toContain("지지 근거");
  });

  it("conflict 우세인 경우 Likely False를 반환한다", () => {
    const sources = [
      createSource({
        id: "source-1",
        sourceType: "official",
        rawTitle: "정부 공식 반박",
        rawSnippet: "해당 주장은 사실 아님",
      }),
      createSource({
        id: "source-2",
        sourceType: "news",
        rawTitle: "Reuters debunked report",
        rawSnippet: "Check was false and denied",
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
      }),
    ];
    const evidenceSnippets = [
      createSnippet({ id: "snippet-1", sourceId: "source-1", snippetText: "사실 아님" }),
      createSnippet({ id: "snippet-2", sourceId: "source-2", snippetText: "false check" }),
    ];

    const result = assembleAnswerResult({
      coreCheck: "트럼프가 오늘 관세를 철회했다",
      rawCheck: "트럼프가 오늘 관세를 철회했대",
      sources,
      evidenceSnippets,
      insufficiencyReason: null,
    });

    expect(result.sourceStances["source-1"]).toBe("conflict");
    expect(result.sourceStances["source-2"]).toBe("conflict");
    expect(result.result.verdict).toBe("Likely False");
    expect(result.result.conflictCount).toBe(2);
    expect(result.result.analysisSummary).toContain(
      '수집된 뉴스들은 대체로 "트럼프가 오늘 관세를 철회했다"과 다른 내용을 담고 있습니다.',
    );
    expect(result.result.analysisSummary).not.toContain("충돌 근거");
  });

  it("지지와 충돌이 함께 있으면 Mixed Evidence를 반환한다", () => {
    const sources = [
      createSource({
        id: "source-1",
        sourceType: "official",
        rawTitle: "정부 공식 설명",
      }),
      createSource({
        id: "source-2",
        sourceType: "news",
        rawTitle: "정정 보도",
        rawSnippet: "정정: 사실 아님",
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
      }),
    ];
    const evidenceSnippets = [
      createSnippet({ id: "snippet-1", sourceId: "source-1", snippetText: "운영 유지" }),
      createSnippet({ id: "snippet-2", sourceId: "source-2", snippetText: "사실 아님" }),
    ];

    const result = assembleAnswerResult({
      coreCheck: "테슬라가 한국에서 철수했다",
      rawCheck: "테슬라가 한국에서 철수했대",
      sources,
      evidenceSnippets,
      insufficiencyReason: null,
    });

    expect(result.result.verdict).toBe("Mixed Evidence");
    expect(result.result.consensusLevel).toBe("medium");
    expect(result.result.analysisSummary).toContain(
      '"테슬라가 한국에서 철수했다"에 대한 보도가 엇갈리고 있습니다.',
    );
    expect(result.result.analysisSummary).toContain(
      "1건의 기사가 이를 뒷받침하지만",
    );
    expect(result.result.uncertaintyItems).toContain(
      "지지 기사와 반박 기사가 함께 확인됩니다.",
    );
  });

  it("scheduled_event의 최신 연기 신호가 있으면 과거 지지 보도만으로 high consensus를 만들지 않는다", () => {
    const sources = [
      createSource({
        id: "source-1",
        rawTitle: "테슬라 로드스터 2026년 4월 공개 전망",
        publishedAt: new Date("2025-12-20T01:00:00.000Z"),
        originQueryIds: ["q1"],
      }),
      createSource({
        id: "source-2",
        rawTitle: "머스크, 로드스터 4월 말 공개 언급",
        publishedAt: new Date("2026-04-02T01:00:00.000Z"),
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
        originQueryIds: ["q1"],
      }),
      createSource({
        id: "source-3",
        rawTitle: "테슬라 로드스터 공개 다음 달로 연기",
        rawSnippet: "2026-04-22 보도기사로 로드스터 공개가 또 연기되었다고 직접 보도함",
        publishedAt: new Date("2026-04-22T01:00:00.000Z"),
        canonicalUrl: "https://example.com/source-3",
        originalUrl: "https://example.com/source-3",
        originQueryIds: ["q4"],
      }),
    ];
    const evidenceSnippets = [
      createSnippet({ id: "snippet-1", sourceId: "source-1", snippetText: "4월 공개 전망" }),
      createSnippet({ id: "snippet-2", sourceId: "source-2", snippetText: "4월 말 공개 언급" }),
      createSnippet({ id: "snippet-3", sourceId: "source-3", snippetText: "공개가 다음 달로 연기" }),
    ];

    const result = assembleAnswerResult({
      coreCheck: "테슬라가 2026년 4월에 로드스터 차량을 공개한다",
      rawCheck: "테슬라가 2026년 4월에 로드스터 차량이 공개되는게 맞나?",
      sources,
      evidenceSnippets,
      insufficiencyReason: null,
      checkType: "scheduled_event",
      searchPlan: createSearchPlan(),
    });

    expect(result.sourceStances["source-3"]).toBe("conflict");
    expect(result.result.verdict).toBe("Mixed Evidence");
    expect(result.result.consensusLevel).toBe("low");
    expect(result.result.confidenceScore).toBeLessThan(80);
    expect(result.result.analysisSummary).toContain(
      '"테슬라가 2026년 4월에 로드스터 차량을 공개한다"에 대해 보도가 엇갈리고 있습니다.',
    );
    expect(result.result.analysisSummary).toContain(
      "4월 2일 보도에서는 이 내용이 예정되어 있었지만, 4월 22일 보도에서 일정 변경 또는 연기 신호가 확인됩니다.",
    );
    expect(result.result.analysisSummary).toContain(
      "검증 성격의 출처가 포함되어 있습니다.",
    );
    expect(result.result.analysisSummary).toContain(
      "현재 상태를 정확히 파악하려면 최신 원문을 직접 확인해 보세요.",
    );
    expect(result.result.analysisSummary).not.toContain("지지 근거");
    expect(result.result.uncertaintyItems).toContain(
      "일정 변경이나 연기 관련 보도가 있어 최신 상태를 재확인할 필요가 있습니다.",
    );
  });

  it("저장된 signal 기준 최신 연기 보도가 있으면 과거 support가 많아도 low consensus를 반환한다", () => {
    const sources = [
      createSource({
        id: "source-1",
        rawTitle: "테슬라 로드스터 2026년 4월 공개 예정",
        publishedAt: new Date("2026-03-01T01:00:00.000Z"),
        originQueryIds: ["q1"],
      }),
      createSource({
        id: "source-2",
        rawTitle: "로드스터 4월 공개 계획 재확인",
        publishedAt: new Date("2026-04-01T01:00:00.000Z"),
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
        originQueryIds: ["q1"],
      }),
      createSource({
        id: "source-3",
        rawTitle: "로드스터 공개 일정 한 달 연기",
        rawSnippet: "최근 보도에서 공개 일정이 다음 달로 미뤄졌다고 전했다.",
        publishedAt: new Date("2026-04-24T01:00:00.000Z"),
        canonicalUrl: "https://example.com/source-3",
        originalUrl: "https://example.com/source-3",
        originQueryIds: ["q4"],
      }),
    ];
    const evidenceSnippets = [
      createSnippet({ id: "snippet-1", sourceId: "source-1", snippetText: "4월 공개 예정" }),
      createSnippet({ id: "snippet-2", sourceId: "source-2", snippetText: "4월 공개 계획" }),
      createSnippet({ id: "snippet-3", sourceId: "source-3", snippetText: "일정이 다음 달로 연기" }),
    ];

    const result = assembleAnswerResult({
      coreCheck: "테슬라가 2026년 4월에 로드스터 차량을 공개한다",
      rawCheck: "테슬라가 2026년 4월에 로드스터 차량이 공개되는게 맞나?",
      sources,
      evidenceSnippets,
      insufficiencyReason: null,
      checkType: "scheduled_event",
      searchPlan: createSearchPlan(),
      evidenceSignals: [
        {
          sourceId: "source-1",
          snippetId: "snippet-1",
          stanceToCheck: "supports",
          temporalRole: "past_plan",
          updateType: "none",
          currentAnswerImpact: "strengthens",
          reason: "과거 4월 공개 예정 보도입니다.",
        },
        {
          sourceId: "source-2",
          snippetId: "snippet-2",
          stanceToCheck: "supports",
          temporalRole: "past_plan",
          updateType: "none",
          currentAnswerImpact: "strengthens",
          reason: "기존 4월 계획을 언급합니다.",
        },
        {
          sourceId: "source-3",
          snippetId: "snippet-3",
          stanceToCheck: "updates",
          temporalRole: "latest_update",
          updateType: "delay",
          currentAnswerImpact: "overrides",
          reason: "더 최근 보도가 4월 공개 일정을 연기된 상태로 업데이트합니다.",
        },
      ],
    });

    expect(result.sourceStances["source-3"]).toBe("conflict");
    expect(result.result.verdict).toBe("Mixed Evidence");
    expect(result.result.consensusLevel).toBe("low");
    expect(result.result.analysisSummary).toContain(
      "일정 변경 또는 연기 신호가 확인됩니다.",
    );
  });

  it("scheduled_event의 postponed 업데이트 신호도 conflict로 분류한다", () => {
    const source = createSource({
      rawTitle: "Tesla Roadster reveal postponed to next month",
      rawSnippet: "The Roadster event was delayed and moved to next month.",
      originQueryIds: ["q4"],
    });

    const result = assembleAnswerResult({
      coreCheck: "Tesla will reveal the Roadster in April 2026",
      rawCheck: "Is Tesla revealing the Roadster in April 2026?",
      sources: [source],
      evidenceSnippets: [
        createSnippet({
          sourceId: source.id,
          snippetText: "Roadster event was postponed to next month",
        }),
      ],
      insufficiencyReason: null,
      checkType: "scheduled_event",
      searchPlan: createSearchPlan(),
    });

    expect(result.sourceStances[source.id]).toBe("conflict");
    expect(result.result.consensusLevel).toBe("low");
  });

  it("근거가 부족하면 Unclear를 반환한다", () => {
    const sources = [
      createSource({
        id: "source-1",
        fetchStatus: "pending",
        relevanceTier: "reference",
        retrievalBucket: "familiar",
        rawSnippet: null,
        contentText: null,
      }),
      createSource({
        id: "source-2",
        relevanceTier: "discard",
        fetchStatus: "pending",
        retrievalBucket: "fallback",
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
        rawSnippet: null,
        contentText: null,
      }),
    ];

    const result = assembleAnswerResult({
      coreCheck: "검토 대상 주장",
      rawCheck: "검토 대상 주장",
      sources,
      evidenceSnippets: [],
      insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    });

    expect(result.result.verdict).toBe("Unclear");
    expect(result.result.confidenceScore).toBeGreaterThanOrEqual(35);
    expect(result.result.confidenceScore).toBeLessThanOrEqual(98);
    expect(result.result.analysisSummary).toContain(
      '수집된 자료만으로는 "검토 대상 주장"을 정확히 판단하기 어렵습니다.',
    );
    expect(result.result.analysisSummary).toContain(
      "더 많은 정보를 확인하려면 관련 기사를 직접 검색해 보세요.",
    );
    expect(result.result.uncertaintySummary).toContain("추가 정보");
    expect(result.result.uncertaintyItems[0]).toBe(
      "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    );
  });
});
