import { DomainRegistryEntry } from "./reviews.types";
import { classifySourceType, selectDomainsForBucket } from "./reviews.utils";

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

  it("familiar bucket에 KR news와 KR social platform domain만 포함한다", () => {
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
      "youtube.com",
    ]);
  });
});
