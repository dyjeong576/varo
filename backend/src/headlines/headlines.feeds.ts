export interface HeadlineFeedConfig {
  publisherKey: string;
  publisherName: string;
  category: "politics" | "economy";
  feedUrl: string;
}

export const HEADLINE_FEEDS: HeadlineFeedConfig[] = [
  /* 보수 (Conservative) */
  {
    publisherKey: "chosun-politics",
    publisherName: "조선일보",
    category: "politics",
    feedUrl: "https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml",
  },
  {
    publisherKey: "donga-politics",
    publisherName: "동아일보",
    category: "politics",
    feedUrl: "https://rss.donga.com/politics.xml",
  },

  /* 중도 (Centrist / Wire) */
  {
    publisherKey: "yonhap-politics",
    publisherName: "연합뉴스",
    category: "politics",
    feedUrl: "https://www.yonhapnewstv.co.kr/browse/feed/",
  },
  {
    publisherKey: "newsis-politics",
    publisherName: "뉴시스",
    category: "politics",
    feedUrl: "https://www.newsis.com/RSS/politics.xml",
  },

  /* 진보 (Progressive) */
  {
    publisherKey: "hani-politics",
    publisherName: "한겨레",
    category: "politics",
    feedUrl: "https://www.hani.co.kr/rss/politics/",
  },
  {
    publisherKey: "khan-politics",
    publisherName: "경향신문",
    category: "politics",
    feedUrl: "https://www.khan.co.kr/rss/rssdata/politic_news.xml",
  },
  {
    publisherKey: "chosun-economy",
    publisherName: "조선일보",
    category: "economy",
    feedUrl: "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml",
  },
  {
    publisherKey: "donga-economy",
    publisherName: "동아일보",
    category: "economy",
    feedUrl: "https://rss.donga.com/economy.xml",
  },
  {
    publisherKey: "yonhap-economy",
    publisherName: "연합뉴스",
    category: "economy",
    feedUrl: "https://www.yonhapnewstv.co.kr/category/news/economy/feed/",
  },
  {
    publisherKey: "newsis-economy",
    publisherName: "뉴시스",
    category: "economy",
    feedUrl: "https://www.newsis.com/RSS/economy.xml",
  },
  {
    publisherKey: "hani-economy",
    publisherName: "한겨레",
    category: "economy",
    feedUrl: "https://www.hani.co.kr/rss/economy/",
  },
  {
    publisherKey: "khan-economy",
    publisherName: "경향신문",
    category: "economy",
    feedUrl: "https://www.khan.co.kr/rss/rssdata/economy_news.xml",
  },
];
