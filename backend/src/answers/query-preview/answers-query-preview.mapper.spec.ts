import { mapStoredPreviewResponse } from "./answers-query-preview.mapper";

describe("answers query preview mapper", () => {
  it("과거 query refinement artifact에 isFactCheckQuestion이 없으면 supported route 기준으로 fallback한다", () => {
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

    expect(response.isFactCheckQuestion).toBe(true);
  });
});
