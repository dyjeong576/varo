export type CanonicalHostStatus = "pending" | "live";
export type AppEnv = "dev" | "prod";

function readEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeOptionalUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return value.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function readCanonicalHostStatus(value: string | undefined): CanonicalHostStatus {
  return value === "live" ? "live" : "pending";
}

function readAppEnv(value: string | undefined): AppEnv {
  return value === "dev" ? "dev" : "prod";
}

export const APP_ENV = readAppEnv(readEnv(process.env.NEXT_PUBLIC_APP_ENV));
export const APP_NAME = readEnv(process.env.NEXT_PUBLIC_APP_NAME) ?? "VARO";
export const APP_TAGLINE =
  readEnv(process.env.NEXT_PUBLIC_APP_TAGLINE) ?? "Verified Analysis, Reasoned Opinion";
export const DEFAULT_LOCAL_APP_URL = "http://localhost:3000";
export const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:4000";
export const APP_PUBLIC_URL = normalizeOptionalUrl(process.env.NEXT_PUBLIC_APP_PUBLIC_URL);
export const APP_INTENDED_PRODUCTION_HOST =
  readEnv(process.env.NEXT_PUBLIC_APP_INTENDED_PRODUCTION_HOST) ?? "www.varocheck.com";
export const APP_CANONICAL_HOST_STATUS = readCanonicalHostStatus(
  readEnv(process.env.NEXT_PUBLIC_APP_CANONICAL_HOST_STATUS),
);
export const APP_DESCRIPTION = `${APP_NAME}는 ${APP_TAGLINE}를 바탕으로 수집된 출처와 판단의 맥락을 구조화합니다.`;

export function getMetadataBase(): URL | undefined {
  if (!APP_PUBLIC_URL || APP_CANONICAL_HOST_STATUS !== "live") {
    return undefined;
  }

  return new URL(APP_PUBLIC_URL);
}
