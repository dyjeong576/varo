"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const session_service_1 = require("./session.service");
const session_response_dto_1 = require("./dto/session-response.dto");
const api_error_response_dto_1 = require("../shared/dto/api-error-response.dto");
const app_config_1 = require("../config/app.config");
let AuthController = class AuthController {
    authService;
    sessionService;
    configService;
    constructor(authService, sessionService, configService) {
        this.authService = authService;
        this.sessionService = sessionService;
        this.configService = configService;
    }
    async startGoogleLogin(redirectTo, response) {
        const flow = this.authService.createGoogleAuthFlow(redirectTo);
        this.sessionService.writeOauthStateCookie(response, flow.stateToken);
        response.redirect(flow.authorizeUrl);
    }
    async handleGoogleCallback(code, state, request, response) {
        const result = await this.authService.handleGoogleCallback({
            code,
            stateToken: state,
            stateCookie: request.cookies?.[this.sessionService.getOauthStateCookieName()],
        });
        this.sessionService.clearOauthStateCookie(response);
        this.sessionService.writeSessionCookie(response, result.sessionId, result.expiresAt);
        const frontendBaseUrl = this.configService.get("frontendBaseUrl") ??
            this.configService.get("FRONTEND_BASE_URL");
        if (!frontendBaseUrl) {
            throw new Error("FRONTEND_BASE_URL이 설정되지 않았습니다.");
        }
        response.redirect((0, app_config_1.buildFrontendRedirectUrl)(frontendBaseUrl, result.redirectTo));
    }
    async getSession(request) {
        return this.authService.getSessionResponse(request.cookies?.[this.sessionService.getCookieName()]);
    }
    async logout(request, response) {
        const sessionId = request.cookies?.[this.sessionService.getCookieName()];
        if (sessionId) {
            await this.sessionService.deleteSession(sessionId);
        }
        this.sessionService.clearSessionCookie(response);
        response.status(common_1.HttpStatus.NO_CONTENT).send();
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)("google"),
    (0, swagger_1.ApiOperation)({
        summary: "구글 로그인 시작",
        description: "구글 OAuth 로그인 페이지로 이동합니다.",
    }),
    (0, swagger_1.ApiQuery)({
        name: "redirectTo",
        required: false,
        description: "로그인 완료 후 이동할 내부 경로",
        example: "/",
    }),
    __param(0, (0, common_1.Query)("redirectTo")),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "startGoogleLogin", null);
__decorate([
    (0, common_1.Get)("google/callback"),
    (0, swagger_1.ApiOperation)({
        summary: "구글 로그인 콜백 처리",
        description: "구글 인증 완료 후 세션을 발급하고 적절한 화면으로 이동시킵니다.",
    }),
    (0, swagger_1.ApiQuery)({ name: "code", required: true, description: "구글 인증 코드" }),
    (0, swagger_1.ApiQuery)({ name: "state", required: true, description: "로그인 상태 검증 토큰" }),
    (0, swagger_1.ApiUnauthorizedResponse)({
        description: "로그인 검증 실패",
        type: api_error_response_dto_1.ApiErrorResponseDto,
    }),
    __param(0, (0, common_1.Query)("code")),
    __param(1, (0, common_1.Query)("state")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "handleGoogleCallback", null);
__decorate([
    (0, common_1.Get)("session"),
    (0, swagger_1.ApiOperation)({
        summary: "현재 세션 조회",
        description: "현재 브라우저 세션과 프로필 완성 여부를 조회합니다.",
    }),
    (0, swagger_1.ApiOkResponse)({
        description: "세션 조회 성공",
        type: session_response_dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiCookieAuth)("sessionAuth"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getSession", null);
__decorate([
    (0, common_1.Post)("logout"),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: "로그아웃",
        description: "현재 세션을 삭제하고 세션 쿠키를 제거합니다.",
    }),
    (0, swagger_1.ApiCookieAuth)("sessionAuth"),
    (0, swagger_1.ApiNoContentResponse)({ description: "로그아웃 완료" }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)("인증 / 세션"),
    (0, common_1.Controller)("auth"),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        session_service_1.SessionService,
        config_1.ConfigService])
], AuthController);
