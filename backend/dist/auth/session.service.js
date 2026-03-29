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
exports.SessionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
let SessionService = class SessionService {
    prisma;
    configService;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async createSession(userId, providerSubject) {
        const ttlDays = this.configService.get("SESSION_TTL_DAYS", 30);
        const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
        const session = await this.prisma.session.create({
            data: {
                userId,
                providerSubject,
                expiresAt,
            },
        });
        return {
            id: session.id,
            expiresAt: session.expiresAt,
        };
    }
    async deleteSession(sessionId) {
        await this.prisma.session.deleteMany({
            where: {
                id: sessionId,
            },
        });
    }
    async resolveSession(sessionId) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
        });
        if (!session) {
            return null;
        }
        if (session.expiresAt <= new Date()) {
            await this.deleteSession(sessionId);
            return null;
        }
        return {
            session: {
                id: session.id,
                expiresAt: session.expiresAt,
            },
            user: {
                id: session.user.id,
                email: session.user.email,
                displayName: session.user.displayName,
                authProvider: session.user.authProvider,
            },
            profile: session.user.profile,
        };
    }
    getProfileComplete(profile) {
        if (!profile) {
            return false;
        }
        return Boolean(profile.realName &&
            profile.gender &&
            profile.ageRange &&
            profile.country &&
            profile.city);
    }
    writeSessionCookie(response, sessionId, expiresAt) {
        response.cookie(this.getCookieName(), sessionId, {
            httpOnly: true,
            sameSite: "lax",
            secure: this.configService.get("APP_ENV") === "prod",
            expires: expiresAt,
            path: "/",
        });
    }
    writeOauthStateCookie(response, token) {
        response.cookie(this.getOauthStateCookieName(), token, {
            httpOnly: true,
            sameSite: "lax",
            secure: this.configService.get("APP_ENV") === "prod",
            maxAge: 10 * 60 * 1000,
            path: "/",
        });
    }
    clearSessionCookie(response) {
        response.clearCookie(this.getCookieName(), {
            httpOnly: true,
            sameSite: "lax",
            secure: this.configService.get("APP_ENV") === "prod",
            path: "/",
        });
    }
    clearOauthStateCookie(response) {
        response.clearCookie(this.getOauthStateCookieName(), {
            httpOnly: true,
            sameSite: "lax",
            secure: this.configService.get("APP_ENV") === "prod",
            path: "/",
        });
    }
    getCookieName() {
        return this.configService.get("SESSION_COOKIE_NAME", "varo_session");
    }
    getOauthStateCookieName() {
        return `${this.getCookieName()}_oauth_state`;
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], SessionService);
