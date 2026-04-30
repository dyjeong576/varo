export type AppEnv = "dev" | "prod";
export type CanonicalHostStatus = "pending" | "live";

export interface AppConfig {
  appName: string;
  appTagline: string;
  appPublicUrl: string | null;
  appIntendedProductionHost: string;
  appCanonicalHostStatus: CanonicalHostStatus;
  port: number;
  nodeEnv: string;
  appEnv: AppEnv;
  databaseUrl: string;
  apiBaseUrl: string;
  frontendBaseUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  sessionSecret: string;
  sessionCookieName: string;
  sessionCookieDomain: string | null;
  sessionTtlDays: number;
  openAiApiKey: string | null;
  naverClientId: string | null;
  naverClientSecret: string | null;
  naverSearchTimeoutMs: number;
  headlineJobSecret: string | null;
  tavilyApiKey: string | null;
  tavilySearchTimeoutMs: number;
  tavilyExtractTimeoutMs: number;
  perplexityApiKey: string | null;
}

export const GOOGLE_CALLBACK_PATH = "/api/v1/auth/google/callback";

function getRequired(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`필수 환경변수 ${name}가 설정되지 않았습니다.`);
  }

  return value;
}

function getOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

export function normalizeBaseUrl(name: string, value: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${name}는 http 또는 https 절대 URL이어야 합니다.`);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`${name}는 http 또는 https 절대 URL이어야 합니다.`);
  }

  return value.replace(/\/+$/, "");
}

function normalizeOptionalBaseUrl(name: string, value?: string): string | null {
  if (!value) {
    return null;
  }

  return normalizeBaseUrl(name, value);
}

function readCanonicalHostStatus(value?: string): CanonicalHostStatus {
  return value === "live" ? "live" : "pending";
}

function readPositiveInteger(name: string, fallback: number): number {
  const rawValue = getOptional(name);

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name}는 1 이상의 정수여야 합니다.`);
  }

  return parsed;
}

function inferSessionCookieDomain(
  frontendBaseUrl: string,
  apiBaseUrl: string,
  appEnv: AppEnv,
): string | null {
  if (appEnv !== "prod") {
    return null;
  }

  const frontendHostname = new URL(frontendBaseUrl).hostname;
  const apiHostname = new URL(apiBaseUrl).hostname;

  if (frontendHostname === apiHostname) {
    return null;
  }

  if (!frontendHostname.startsWith("www.") || !apiHostname.startsWith("api.")) {
    return null;
  }

  const frontendRootDomain = frontendHostname.slice("www.".length);
  const apiRootDomain = apiHostname.slice("api.".length);

  if (!frontendRootDomain || frontendRootDomain !== apiRootDomain) {
    return null;
  }

  return frontendRootDomain;
}

export function buildGoogleCallbackUrl(apiBaseUrl: string): string {
  const normalizedBaseUrl = normalizeBaseUrl("API_BASE_URL", apiBaseUrl);

  return `${normalizedBaseUrl}${GOOGLE_CALLBACK_PATH}`;
}

export function buildFrontendRedirectUrl(frontendBaseUrl: string, redirectPath: string): string {
  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    throw new Error("redirectPath는 내부 경로여야 합니다.");
  }

  const normalizedBaseUrl = normalizeBaseUrl("FRONTEND_BASE_URL", frontendBaseUrl);

  return `${normalizedBaseUrl}${redirectPath}`;
}

export function getAppConfig(): AppConfig {
  const appEnv = getRequired("APP_ENV");

  if (appEnv !== "dev" && appEnv !== "prod") {
    throw new Error("APP_ENV는 dev 또는 prod여야 합니다.");
  }

  const ttl = Number(getRequired("SESSION_TTL_DAYS"));

  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error("SESSION_TTL_DAYS는 1 이상의 정수여야 합니다.");
  }

  const appName = getOptional("APP_NAME") ?? "VARO";
  const appTagline = getOptional("APP_TAGLINE") ?? "Verified Analysis, Reasoned Opinion";
  const appPublicUrl = normalizeOptionalBaseUrl("APP_PUBLIC_URL", getOptional("APP_PUBLIC_URL"));
  const apiBaseUrl = normalizeBaseUrl("API_BASE_URL", getRequired("API_BASE_URL"));
  const frontendBaseUrl = normalizeBaseUrl("FRONTEND_BASE_URL", getRequired("FRONTEND_BASE_URL"));
  const sessionCookieDomain =
    getOptional("SESSION_COOKIE_DOMAIN") ??
    inferSessionCookieDomain(frontendBaseUrl, apiBaseUrl, appEnv);

  return {
    appName,
    appTagline,
    appPublicUrl,
    appIntendedProductionHost: getOptional("APP_INTENDED_PRODUCTION_HOST") ?? "www.varocheck.com",
    appCanonicalHostStatus: readCanonicalHostStatus(getOptional("APP_CANONICAL_HOST_STATUS")),
    port: Number(process.env.PORT ?? 4000),
    nodeEnv: process.env.NODE_ENV ?? "development",
    appEnv,
    databaseUrl: getRequired("DATABASE_URL"),
    apiBaseUrl,
    frontendBaseUrl,
    googleClientId: getRequired("GOOGLE_CLIENT_ID"),
    googleClientSecret: getRequired("GOOGLE_CLIENT_SECRET"),
    googleCallbackUrl: buildGoogleCallbackUrl(apiBaseUrl),
    sessionSecret: getRequired("SESSION_SECRET"),
    sessionCookieName: getRequired("SESSION_COOKIE_NAME"),
    sessionCookieDomain,
    sessionTtlDays: ttl,
    openAiApiKey: getOptional("OPENAI_API_KEY") ?? null,
    naverClientId: getOptional("NAVER_CLIENT_ID") ?? null,
    naverClientSecret: getOptional("NAVER_CLIENT_SECRET") ?? null,
    naverSearchTimeoutMs: readPositiveInteger("NAVER_SEARCH_TIMEOUT_MS", 40000),
    headlineJobSecret: getOptional("HEADLINE_JOB_SECRET") ?? null,
    tavilyApiKey: getOptional("TAVILY_API_KEY") ?? null,
    tavilySearchTimeoutMs: readPositiveInteger("TAVILY_SEARCH_TIMEOUT_MS", 40000),
    tavilyExtractTimeoutMs: readPositiveInteger("TAVILY_EXTRACT_TIMEOUT_MS", 180000),
    perplexityApiKey: getOptional("PERPLEXITY_API_KEY") ?? null,
  };
}
