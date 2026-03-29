"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOOGLE_CALLBACK_PATH = void 0;
exports.normalizeBaseUrl = normalizeBaseUrl;
exports.buildGoogleCallbackUrl = buildGoogleCallbackUrl;
exports.buildFrontendRedirectUrl = buildFrontendRedirectUrl;
exports.getAppConfig = getAppConfig;
exports.GOOGLE_CALLBACK_PATH = "/api/v1/auth/google/callback";
function getRequired(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`필수 환경변수 ${name}가 설정되지 않았습니다.`);
    }
    return value;
}
function normalizeBaseUrl(name, value) {
    let parsedUrl;
    try {
        parsedUrl = new URL(value);
    }
    catch {
        throw new Error(`${name}는 http 또는 https 절대 URL이어야 합니다.`);
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error(`${name}는 http 또는 https 절대 URL이어야 합니다.`);
    }
    return value.replace(/\/+$/, "");
}
function buildGoogleCallbackUrl(apiBaseUrl) {
    const normalizedBaseUrl = normalizeBaseUrl("API_BASE_URL", apiBaseUrl);
    return `${normalizedBaseUrl}${exports.GOOGLE_CALLBACK_PATH}`;
}
function buildFrontendRedirectUrl(frontendBaseUrl, redirectPath) {
    if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
        throw new Error("redirectPath는 내부 경로여야 합니다.");
    }
    const normalizedBaseUrl = normalizeBaseUrl("FRONTEND_BASE_URL", frontendBaseUrl);
    return `${normalizedBaseUrl}${redirectPath}`;
}
function getAppConfig() {
    const appEnv = getRequired("APP_ENV");
    if (appEnv !== "dev" && appEnv !== "prod") {
        throw new Error("APP_ENV는 dev 또는 prod여야 합니다.");
    }
    const ttl = Number(getRequired("SESSION_TTL_DAYS"));
    if (!Number.isInteger(ttl) || ttl <= 0) {
        throw new Error("SESSION_TTL_DAYS는 1 이상의 정수여야 합니다.");
    }
    const apiBaseUrl = normalizeBaseUrl("API_BASE_URL", getRequired("API_BASE_URL"));
    const frontendBaseUrl = normalizeBaseUrl("FRONTEND_BASE_URL", getRequired("FRONTEND_BASE_URL"));
    return {
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
        sessionTtlDays: ttl,
    };
}
