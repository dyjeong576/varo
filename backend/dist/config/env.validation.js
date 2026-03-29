"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
function requireString(config, key) {
    const value = config[key];
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`필수 환경변수 ${key}가 설정되지 않았습니다.`);
    }
    return value;
}
function validateEnv(config) {
    const appEnv = requireString(config, "APP_ENV");
    if (appEnv !== "dev" && appEnv !== "prod") {
        throw new Error("APP_ENV는 dev 또는 prod여야 합니다.");
    }
    const port = Number(config.PORT ?? 4000);
    if (!Number.isInteger(port) || port <= 0) {
        throw new Error("PORT는 1 이상의 정수여야 합니다.");
    }
    const sessionTtlDays = Number(config.SESSION_TTL_DAYS);
    if (!Number.isInteger(sessionTtlDays) || sessionTtlDays <= 0) {
        throw new Error("SESSION_TTL_DAYS는 1 이상의 정수여야 합니다.");
    }
    return {
        PORT: port,
        NODE_ENV: typeof config.NODE_ENV === "string" ? config.NODE_ENV : "development",
        APP_ENV: appEnv,
        DATABASE_URL: requireString(config, "DATABASE_URL"),
        API_BASE_URL: requireString(config, "API_BASE_URL"),
        FRONTEND_BASE_URL: requireString(config, "FRONTEND_BASE_URL"),
        GOOGLE_CLIENT_ID: requireString(config, "GOOGLE_CLIENT_ID"),
        GOOGLE_CLIENT_SECRET: requireString(config, "GOOGLE_CLIENT_SECRET"),
        GOOGLE_CALLBACK_URL: requireString(config, "GOOGLE_CALLBACK_URL"),
        SESSION_SECRET: requireString(config, "SESSION_SECRET"),
        SESSION_COOKIE_NAME: requireString(config, "SESSION_COOKIE_NAME"),
        SESSION_TTL_DAYS: sessionTtlDays,
    };
}
