import { EvidenceSnippet, Source } from "@prisma/client";
import { assembleReviewResult } from "./review-result-assembler";

function createSource(overrides: Partial<Source>): Source {
  return {
    id: "source-1",
    reviewJobId: "review-1",
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
    sourceCountryCode: "US",
    retrievalBucket: "verification",
    domainRegistryId: "registry-1",
    ...overrides,
  };
}

function createSnippet(overrides: Partial<EvidenceSnippet>): EvidenceSnippet {
  return {
    id: "snippet-1",
    reviewJobId: "review-1",
    sourceId: "source-1",
    snippetText: "기본 snippet",
    stance: "neutral",
    startOffset: null,
    endOffset: null,
    ...overrides,
  };
}

describe("assembleReviewResult", () => {
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

    const result = assembleReviewResult({
      coreClaim: "서울시 무제한 교통권 세계 최초",
      rawClaim: "서울시 무제한 교통권 세계 최초래",
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
        rawSnippet: "Claim was false and denied",
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
      }),
    ];
    const evidenceSnippets = [
      createSnippet({ id: "snippet-1", sourceId: "source-1", snippetText: "사실 아님" }),
      createSnippet({ id: "snippet-2", sourceId: "source-2", snippetText: "false claim" }),
    ];

    const result = assembleReviewResult({
      coreClaim: "트럼프가 오늘 관세를 철회했다",
      rawClaim: "트럼프가 오늘 관세를 철회했대",
      sources,
      evidenceSnippets,
      insufficiencyReason: null,
    });

    expect(result.sourceStances["source-1"]).toBe("conflict");
    expect(result.sourceStances["source-2"]).toBe("conflict");
    expect(result.result.verdict).toBe("Likely False");
    expect(result.result.conflictCount).toBe(2);
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

    const result = assembleReviewResult({
      coreClaim: "테슬라가 한국에서 철수했다",
      rawClaim: "테슬라가 한국에서 철수했대",
      sources,
      evidenceSnippets,
      insufficiencyReason: null,
    });

    expect(result.result.verdict).toBe("Mixed Evidence");
    expect(result.result.consensusLevel).toBe("medium");
    expect(result.result.uncertaintyItems).toContain(
      "지지와 충돌 근거가 함께 있어 단일 결론으로 보기 어렵습니다.",
    );
  });

  it("근거가 부족하면 Unclear를 반환한다", () => {
    const sources = [
      createSource({
        id: "source-1",
        fetchStatus: "pending",
        relevanceTier: "reference",
        retrievalBucket: "familiar",
        domainRegistryId: null,
        rawSnippet: null,
        contentText: null,
      }),
      createSource({
        id: "source-2",
        relevanceTier: "discard",
        fetchStatus: "pending",
        retrievalBucket: "fallback",
        domainRegistryId: null,
        canonicalUrl: "https://example.com/source-2",
        originalUrl: "https://example.com/source-2",
        rawSnippet: null,
        contentText: null,
      }),
    ];

    const result = assembleReviewResult({
      coreClaim: "검토 대상 주장",
      rawClaim: "검토 대상 주장",
      sources,
      evidenceSnippets: [],
      insufficiencyReason: "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    });

    expect(result.result.verdict).toBe("Unclear");
    expect(result.result.confidenceScore).toBeGreaterThanOrEqual(35);
    expect(result.result.confidenceScore).toBeLessThanOrEqual(98);
    expect(result.result.uncertaintySummary).toContain("임시 결과");
    expect(result.result.uncertaintyItems[0]).toBe(
      "extract 가능한 source가 없어 evidence 부족 상태로 handoff 됩니다.",
    );
  });
});
