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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const app_error_codes_1 = require("../common/constants/app-error-codes");
const app_exception_1 = require("../common/exceptions/app-exception");
const prisma_service_1 = require("../prisma/prisma.service");
const session_service_1 = require("../auth/session.service");
let UsersService = class UsersService {
    prisma;
    sessionService;
    constructor(prisma, sessionService) {
        this.prisma = prisma;
        this.sessionService = sessionService;
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user || !user.profile) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "사용자 정보를 찾을 수 없습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                authProvider: user.authProvider,
            },
            profile: {
                realName: user.profile.realName,
                gender: user.profile.gender,
                ageRange: user.profile.ageRange,
                country: user.profile.country,
                city: user.profile.city,
            },
            profileComplete: this.sessionService.getProfileComplete(user.profile),
        };
    }
    async updateProfile(userId, payload) {
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!existing || !existing.profile) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED, "사용자 프로필을 찾을 수 없습니다.", common_1.HttpStatus.UNAUTHORIZED);
        }
        const profile = existing.profile;
        const isComplete = this.sessionService.getProfileComplete(profile);
        if (!isComplete) {
            this.ensureInitialProfilePayload(payload);
        }
        else {
            this.ensureMutableFieldsOnly(profile, payload);
        }
        const updated = await this.prisma.userProfile.update({
            where: { userId },
            data: {
                realName: payload.realName ?? undefined,
                gender: payload.gender ?? undefined,
                ageRange: payload.ageRange ?? undefined,
                country: payload.country ?? undefined,
                city: payload.city ?? undefined,
            },
        });
        return {
            user: {
                id: existing.id,
                email: existing.email,
                displayName: existing.displayName,
                authProvider: existing.authProvider,
            },
            profile: {
                realName: updated.realName,
                gender: updated.gender,
                ageRange: updated.ageRange,
                country: updated.country,
                city: updated.city,
            },
            profileComplete: this.sessionService.getProfileComplete(updated),
        };
    }
    ensureInitialProfilePayload(payload) {
        const requiredFields = [
            "realName",
            "gender",
            "ageRange",
            "country",
            "city",
        ];
        const missingFields = requiredFields.filter((field) => !payload[field]);
        if (missingFields.length > 0) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.INPUT_VALIDATION_ERROR, "첫 로그인 시에는 이름, 성별, 나이대, 국가, 도시를 모두 입력해야 합니다.", common_1.HttpStatus.BAD_REQUEST, { missingFields });
        }
    }
    ensureMutableFieldsOnly(profile, payload) {
        if (payload.realName && payload.realName !== profile.realName) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.FORBIDDEN, "이름은 최초 설정 이후 수정할 수 없습니다.", common_1.HttpStatus.FORBIDDEN);
        }
        if (payload.gender && payload.gender !== profile.gender) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.FORBIDDEN, "성별은 최초 설정 이후 수정할 수 없습니다.", common_1.HttpStatus.FORBIDDEN);
        }
        if (payload.ageRange && payload.ageRange !== profile.ageRange) {
            throw new app_exception_1.AppException(app_error_codes_1.APP_ERROR_CODES.FORBIDDEN, "나이대는 최초 설정 이후 수정할 수 없습니다.", common_1.HttpStatus.FORBIDDEN);
        }
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        session_service_1.SessionService])
], UsersService);
