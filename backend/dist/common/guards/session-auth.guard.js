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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_error_codes_1 = require("../constants/app-error-codes");
const app_exception_1 = require("../exceptions/app-exception");
const session_service_1 = require("../../auth/session.service");
let SessionAuthGuard = class SessionAuthGuard {
    sessionService;
    configService;
    constructor(sessionService, configService) {
        this.sessionService = sessionService;
        this.configService = configService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const cookieName = this.configService.get("SESSION_COOKIE_NAME", "varo_session");
        const sessionToken = request.cookies?.[cookieName];
        if (!sessionToken) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "로그인이 필요합니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        const resolved = await this.sessionService.resolveSession(sessionToken);
        if (!resolved) {
            this.sessionService.clearSessionCookie(response);
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "세션이 만료되었거나 유효하지 않습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        request.sessionId = resolved.session.id;
        request.sessionExpiresAt = resolved.session.expiresAt;
        request.currentUser = {
            id: resolved.user.id,
            email: resolved.user.email,
            displayName: resolved.user.displayName,
            authProvider: resolved.user.authProvider,
        };
        request.currentProfile = resolved.profile;
        return true;
    }
};
exports.SessionAuthGuard = SessionAuthGuard;
exports.SessionAuthGuard = SessionAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService,
        config_1.ConfigService])
], SessionAuthGuard);
