"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleOAuthService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_url_1 = require("node:url");
const app_exception_1 = require("../common/exceptions/app-exception");
const app_error_codes_1 = require("../common/constants/app-error-codes");
const app_config_1 = require("../config/app.config");
let GoogleOAuthService = class GoogleOAuthService {
    config = (0, app_config_1.getAppConfig)();
    createStateToken(redirectTo) {
        const payload = {
            nonce: (0, node_crypto_1.randomBytes)(12).toString("hex"),
            redirectTo: this.sanitizeRedirectTo(redirectTo),
            issuedAt: Date.now(),
        };
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
        const signature = this.sign(encodedPayload);
        return `${encodedPayload}.${signature}`;
    }
    validateStateToken(token) {
        const [encodedPayload, signature] = token.split(".");
        if (!encodedPayload || !signature || this.sign(encodedPayload) !== signature) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "로그인 상태 검증에 실패했습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
        if (Date.now() - payload.issuedAt > 10 * 60 * 1000) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "로그인 시도가 만료되었습니다. 다시 시도해 주세요.", common_1.HttpStatus.UNAUTHORIZED);
        }
        return payload;
    }
    buildAuthorizeUrl(state) {
        const query = new node_url_1.URLSearchParams({
            client_id: this.config.googleClientId,
            redirect_uri: this.config.googleCallbackUrl,
            response_type: "code",
            scope: "openid email profile",
            state,
            access_type: "offline",
            prompt: "consent",
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
    }
    async exchangeCodeForUser(code) {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new node_url_1.URLSearchParams({
                code,
                client_id: this.config.googleClientId,
                client_secret: this.config.googleClientSecret,
                redirect_uri: this.config.googleCallbackUrl,
                grant_type: "authorization_code",
            }),
        });
        if (!tokenResponse.ok) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "구글 토큰 교환에 실패했습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        const tokenData = (await tokenResponse.json());
        const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: {
                authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        if (!userInfoResponse.ok) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "구글 사용자 정보 조회에 실패했습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        const userInfo = (await userInfoResponse.json());
        if (!userInfo.email_verified) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "이메일 인증이 완료된 구글 계정만 사용할 수 있습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        return userInfo;
    }
    sanitizeRedirectTo(redirectTo) {
        if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
            return "/";
        }
        return redirectTo;
    }
    sign(value) {
        return (0, node_crypto_1.createHmac)("sha256", this.config.sessionSecret).update(value).digest("base64url");
    }
};
exports.GoogleOAuthService = GoogleOAuthService;
exports.GoogleOAuthService = GoogleOAuthService = __decorate([
    (0, common_1.Injectable)()
], GoogleOAuthService);
