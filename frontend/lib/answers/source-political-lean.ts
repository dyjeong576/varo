export type SourcePoliticalLean = "progressive" | "conservative" | "centrist" | "other";

export interface SourcePoliticalLeanBadge {
  lean: SourcePoliticalLean;
  label: string;
  className: string;
}

interface SourcePoliticalLeanInput {
  publisherName: string | null;
  canonicalUrl: string;
  originalUrl: string;
}

const SOURCE_POLITICAL_LEAN_BY_DOMAIN: Record<string, SourcePoliticalLean> = {
  "chosun.com": "conservative",
  "dailian.co.kr": "conservative",
  "donga.com": "conservative",
  "hankyung.com": "conservative",
  "ichannela.com": "conservative",
  "imaeil.com": "conservative",
  "mk.co.kr": "conservative",
  "munhwa.com": "conservative",
  "newdaily.co.kr": "conservative",
  "segye.com": "conservative",
  "tvchosun.com": "conservative",
  "asiae.co.kr": "centrist",
  "biz.sbs.co.kr": "centrist",
  "edaily.co.kr": "centrist",
  "fnnews.com": "centrist",
  "heraldcorp.com": "centrist",
  "jtbc.co.kr": "centrist",
  "kbs.co.kr": "centrist",
  "mt.co.kr": "centrist",
  "news1.kr": "centrist",
  "newsis.com": "centrist",
  "sbs.co.kr": "centrist",
  "sedaily.com": "centrist",
  "seoul.co.kr": "centrist",
  "yna.co.kr": "centrist",
  "yonhapnewstv.co.kr": "centrist",
  "hani.co.kr": "progressive",
  "imbc.com": "progressive",
  "khan.co.kr": "progressive",
  "mediatoday.co.kr": "progressive",
  "nocutnews.co.kr": "progressive",
  "ohmynews.com": "progressive",
  "pressian.com": "progressive",
  "sisain.co.kr": "progressive",
};

const SOURCE_POLITICAL_LEAN_BY_PUBLISHER: Record<string, SourcePoliticalLean> = {
  "조선일보": "conservative",
  "데일리안": "conservative",
  "동아일보": "conservative",
  "한국경제": "conservative",
  "채널A": "conservative",
  "매일신문": "conservative",
  "매일경제": "conservative",
  "문화일보": "conservative",
  "뉴데일리": "conservative",
  "세계일보": "conservative",
  "TV조선": "conservative",
  "아시아경제": "centrist",
  "SBS Biz": "centrist",
  "이데일리": "centrist",
  "파이낸셜뉴스": "centrist",
  "헤럴드경제": "centrist",
  "JTBC": "centrist",
  "KBS": "centrist",
  "머니투데이": "centrist",
  "뉴스1": "centrist",
  "뉴시스": "centrist",
  "SBS": "centrist",
  "서울경제": "centrist",
  "서울신문": "centrist",
  "연합뉴스": "centrist",
  "연합뉴스TV": "centrist",
  "한겨레": "progressive",
  "MBC": "progressive",
  "경향신문": "progressive",
  "미디어오늘": "progressive",
  "노컷뉴스": "progressive",
  "오마이뉴스": "progressive",
  "프레시안": "progressive",
  "시사IN": "progressive",
};

const SOURCE_POLITICAL_LEAN_BADGES: Record<SourcePoliticalLean, SourcePoliticalLeanBadge> = {
  progressive: {
    lean: "progressive",
    label: "진보",
    className: "border-[#dce8ff] bg-[#eef5ff] text-[#0050cb]",
  },
  conservative: {
    lean: "conservative",
    label: "보수",
    className: "border-[#fde3df] bg-[#fff1ef] text-[#ba1a1a]",
  },
  centrist: {
    lean: "centrist",
    label: "중도",
    className: "border-[#e5e7eb] bg-[#f6f7f9] text-[#556070]",
  },
  other: {
    lean: "other",
    label: "기타",
    className: "border-[#e5e7eb] bg-white text-[#6b7280]",
  },
};

export function getSourcePoliticalLeanBadge(
  source: SourcePoliticalLeanInput,
): SourcePoliticalLeanBadge {
  const lean =
    findLeanByUrl(source.canonicalUrl) ??
    findLeanByUrl(source.originalUrl) ??
    findLeanByPublisher(source.publisherName) ??
    "other";

  return SOURCE_POLITICAL_LEAN_BADGES[lean];
}

function findLeanByUrl(url: string): SourcePoliticalLean | null {
  const hostname = extractHostname(url);

  if (!hostname) {
    return null;
  }

  const matchedDomain = Object.keys(SOURCE_POLITICAL_LEAN_BY_DOMAIN).find(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  return matchedDomain ? SOURCE_POLITICAL_LEAN_BY_DOMAIN[matchedDomain] : null;
}

function findLeanByPublisher(publisherName: string | null): SourcePoliticalLean | null {
  if (!publisherName) {
    return null;
  }

  return SOURCE_POLITICAL_LEAN_BY_PUBLISHER[publisherName.trim()] ?? null;
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
