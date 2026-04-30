import { HeadlinesRssParserService } from "./headlines-rss-parser.service";

describe("HeadlinesRssParserService", () => {
  it("RSS item의 제목, 링크, 요약, 발행시각을 정규화한다", () => {
    const service = new HeadlinesRssParserService();
    const items = service.parse(`
      <rss>
        <channel>
          <item>
            <title><![CDATA[정부 &amp; 국회, 새 정책 발표]]></title>
            <link>https://news.example.com/a?utm_source=rss</link>
            <description><![CDATA[<p>핵심 요약입니다.</p>]]></description>
            <pubDate>Thu, 30 Apr 2026 01:00:00 +0900</pubDate>
          </item>
        </channel>
      </rss>
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "정부 & 국회, 새 정책 발표",
      url: "https://news.example.com/a?utm_source=rss",
      summary: "핵심 요약입니다.",
    });
    expect(items[0].publishedAt?.toISOString()).toBe("2026-04-29T16:00:00.000Z");
  });

  it("Atom entry도 파싱한다", () => {
    const service = new HeadlinesRssParserService();
    const items = service.parse(`
      <feed>
        <entry>
          <title>Atom 제목</title>
          <link href="https://news.example.com/atom" />
          <summary>Atom 요약</summary>
          <updated>2026-04-30T00:00:00+09:00</updated>
        </entry>
      </feed>
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Atom 제목",
      url: "https://news.example.com/atom",
      summary: "Atom 요약",
    });
  });
});
