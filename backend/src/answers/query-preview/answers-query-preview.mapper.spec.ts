import { mapStoredPreviewResponse } from "./answers-query-preview.mapper";

describe("answers query preview mapper", () => {
  it("과거 query refinement artifact에 answerMode가 없으면 supported route 기준으로 fallback한다", () => {
    const response = mapStoredPreviewResponse({
      id: "answer-1",
      clientRequestId: null,
      status: "partial",
      currentStage: "handoff_ready",
      searchedSourceCount: 0,
      lastErrorCode: null,
      createdAt: new Date("2026-04-30T00:00:00.000Z"),
      check: {
        id: "check-1",
        rawText: "한국은행이 기준금리를 동결했대",
        normalizedText: "한국은행이 기준금리를 동결했다",
      },
      queryRefinement: {
        coreCheck: "한국은행 기준금리 동결",
        normalizedCheck: "한국은행이 기준금리를 동결했다",
        checkType: "policy",
        searchRoute: "supported",
        generatedQueries: [],
      },
      handoffPayload: null,
      sources: [],
      evidenceSnippets: [],
    } as never);
    expect(response.answerMode).toBe("fact_check");
  });

  it("context answer artifact는 verdict 없이 관련 뉴스 모드로 반환한다", () => {
    const response = mapStoredPreviewResponse({
      id: "answer-1",
      clientRequestId: null,
      status: "partial",
      currentStage: "handoff_ready",
      searchedSourceCount: 1,
      lastErrorCode: null,
      createdAt: new Date("2026-04-30T00:00:00.000Z"),
      check: {
        id: "check-1",
        rawText: "부동산 정책이 왜 논란이야?",
        normalizedText: "부동산 정책 논란 배경",
      },
      queryRefinement: {
        coreCheck: "부동산 정책 논란 배경",
        normalizedCheck: "부동산 정책 논란 배경",
        checkType: "policy",
        answerMode: "context_answer_with_news",
        searchRoute: "supported",
        searchPlan: { queries: [] },
        generatedQueries: [],
      },
      handoffPayload: {
        coreCheck: "부동산 정책 논란 배경",
        sourceIds: [],
        snippetIds: [],
        insufficiencyReason: null,
        evidenceSignals: [],
        answerSummary: {
          analysisSummary: "부동산 정책 논란은 세금과 공급 대책을 둘러싼 쟁점이 큽니다.",
          uncertaintySummary: "관련 뉴스 맥락 답변입니다.",
          uncertaintyItems: [],
        },
      },
      sources: [],
      evidenceSnippets: [],
    } as never);

    expect(response.answerMode).toBe("context_answer_with_news");
    expect(response.result?.verdict).toBeNull();
    expect(response.result?.analysisSummary).toContain("부동산 정책");
  });
});
