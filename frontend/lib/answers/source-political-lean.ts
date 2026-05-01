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
  "donga.com": "conservative",
  "hankyung.com": "conservative",
  "mk.co.kr": "conservative",
  "segye.com": "conservative",
  "hankookilbo.com": "centrist",
  "imbc.com": "centrist",
  "joongang.co.kr": "centrist",
  "kbs.co.kr": "centrist",
  "sbs.co.kr": "centrist",
  "yna.co.kr": "centrist",
  "ytn.co.kr": "centrist",
  "hani.co.kr": "progressive",
  "khan.co.kr": "progressive",
  "ohmynews.com": "progressive",
  "pressian.com": "progressive",
};

const SOURCE_POLITICAL_LEAN_BY_PUBLISHER: Record<string, SourcePoliticalLean> = {
  "조선일보": "conservative",
  "동아일보": "conservative",
  "한국경제": "conservative",
  "매일경제": "conservative",
  "세계일보": "conservative",
  "연합뉴스": "centrist",
  "중앙일보": "centrist",
  "한국일보": "centrist",
  "YTN": "centrist",
  "KBS": "centrist",
  "MBC": "centrist",
  "SBS": "centrist",
  "한겨레": "progressive",
  "경향신문": "progressive",
  "오마이뉴스": "progressive",
  "프레시안": "progressive",
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
