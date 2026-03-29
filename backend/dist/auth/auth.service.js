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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const google_oauth_service_1 = require("./google-oauth.service");
const session_service_1 = require("./session.service");
const app_exception_1 = require("../common/exceptions/app-exception");
const app_error_codes_1 = require("../common/constants/app-error-codes");
let AuthService = class AuthService {
    prisma;
    googleOAuthService;
    sessionService;
    constructor(prisma, googleOAuthService, sessionService) {
        this.prisma = prisma;
        this.googleOAuthService = googleOAuthService;
        this.sessionService = sessionService;
    }
    createGoogleAuthFlow(redirectTo) {
        const stateToken = this.googleOAuthService.createStateToken(redirectTo);
        return {
            stateToken,
            authorizeUrl: this.googleOAuthService.buildAuthorizeUrl(stateToken),
        };
    }
    async handleGoogleCallback(params) {
        const { code, stateToken, stateCookie } = params;
        if (!stateCookie || stateCookie !== stateToken) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "로그인 검증 정보가 일치하지 않습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        const payload = this.googleOAuthService.validateStateToken(stateToken);
        const googleUser = await this.googleOAuthService.exchangeCodeForUser(code);
        const user = await this.prisma.user.upsert({
            where: {
                email: googleUser.email,
            },
            update: {
                displayName: googleUser.name ?? googleUser.email,
            },
            create: {
                email: googleUser.email,
                displayName: googleUser.name ?? googleUser.email,
                authProvider: "google",
                profile: {
                    create: {},
                },
            },
            include: {
                profile: true,
            },
        });
        if (!user.profile) {
            await this.prisma.userProfile.create({
                data: {
                    userId: user.id,
                },
            });
        }
        const session = await this.sessionService.createSession(user.id, googleUser.sub);
        const profile = user.profile ?? null;
        const redirectTo = this.sessionService.getProfileComplete(profile)
            ? payload.redirectTo
            : "/onboarding/profile";
        return {
            sessionId: session.id,
            expiresAt: session.expiresAt,
            redirectTo,
        };
    }
    async getSessionResponse(sessionId) {
        if (!sessionId) {
            return this.buildGuestSession();
        }
        const resolved = await this.sessionService.resolveSession(sessionId);
        if (!resolved) {
            return this.buildGuestSession();
        }
        return {
            isAuthenticated: true,
            expiresAt: resolved.session.expiresAt.toISOString(),
            profileComplete: this.sessionService.getProfileComplete(resolved.profile),
            user: resolved.user,
            profile: resolved.profile
                ? {
                    realName: resolved.profile.realName,
                    gender: resolved.profile.gender,
                    ageRange: resolved.profile.ageRange,
                    country: resolved.profile.country,
                    city: resolved.profile.city,
                }
                : null,
        };
    }
    buildGuestSession() {
        return {
            isAuthenticated: false,
            expiresAt: null,
            profileComplete: false,
            user: null,
            profile: null,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        google_oauth_service_1.GoogleOAuthService,
        session_service_1.SessionService])
], AuthService);
