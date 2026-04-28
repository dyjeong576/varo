import { DomainRegistryEntry, SearchCandidate } from "./reviews.types";
import {
  classifySourceType,
  deduplicateCandidates,
  getKoreanSearchDomainRegistry,
  selectDomainsForBucket,
} from "./reviews.utils";

describe("reviews utils", () => {
  it("주요 social platform URL을 social source type으로 분류한다", () => {
    expect(
      classifySourceType(
        "https://www.youtube.com/watch?v=test",
        "공식 채널 발표",
      ),
    ).toBe("social");
    expect(
      classifySourceType(
        "https://x.com/official/status/123",
        "공식 계정 공지",
      ),
    ).toBe("social");
  });

  it("familiar bucket에 KR news domain만 포함한다", () => {
    const registry: DomainRegistryEntry[] = [
      {
        id: "kr-news",
        domain: "yna.co.kr",
        countryCode: "KR",
        languageCode: "ko",
        sourceKind: "news_agency",
        usageRole: "familiar_news",
        priority: 10,
        isActive: true,
      },
      {
        id: "kr-social",
        domain: "youtube.com",
        countryCode: "KR",
        languageCode: null,
        sourceKind: "social_platform",
        usageRole: "familiar_social",
        priority: 20,
        isActive: true,
      },
      {
        id: "kr-official",
        domain: "*.go.kr",
        countryCode: "KR",
        languageCode: "ko",
        sourceKind: "government",
        usageRole: "verification_official",
        priority: 30,
        isActive: true,
      },
      {
        id: "us-social",
        domain: "facebook.com",
        countryCode: "US",
        languageCode: null,
        sourceKind: "social_platform",
        usageRole: "familiar_social",
        priority: 5,
        isActive: true,
      },
    ];

    expect(selectDomainsForBucket(registry, "familiar")).toEqual([
      "yna.co.kr",
    ]);
  });

  it("코드에 고정된 KR trusted news registry에 정치 성향 메타데이터를 포함한다", () => {
    expect(getKoreanSearchDomainRegistry()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publisherName: "한겨레", politicalLean: "progressive" }),
        expect.objectContaining({ publisherName: "연합뉴스", politicalLean: "centrist" }),
        expect.objectContaining({ publisherName: "조선일보", politicalLean: "conservative" }),
        expect.objectContaining({ publisherName: "매일경제", politicalLean: "business" }),
      ]),
    );
  });

  it("중복 후보 병합 시 정치 성향 메타데이터를 유지한다", () => {
    const baseCandidate = {
      id: "c1",
      searchRoute: "korean_news",
      sourceProvider: "naver-search",
      sourceType: "news",
      publisherName: "연합뉴스",
      publishedAt: null,
      canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      rawTitle: "테스트 기사",
      rawSnippet: null,
      normalizedHash: "hash-1",
      originQueryIds: ["q1"],
      sourceCountryCode: "KR",
      retrievalBucket: "familiar",
      domainRegistryId: null,
    } satisfies SearchCandidate;

    const result = deduplicateCandidates([
      baseCandidate,
      {
        ...baseCandidate,
        id: "c2",
        sourceProvider: "tavily-search",
        originQueryIds: ["q2"],
        sourcePoliticalLean: "centrist",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.originQueryIds).toEqual(["q1", "q2"]);
    expect(result[0]?.sourcePoliticalLean).toBe("centrist");
  });
});
