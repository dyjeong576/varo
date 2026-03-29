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
exports.SessionResponseDto = exports.SessionProfileDto = exports.SessionUserDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class SessionUserDto {
    id;
    email;
    displayName;
    authProvider;
}
exports.SessionUserDto = SessionUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "사용자 식별자", example: "5c47b0f3-11c0-4ec6-8e3a-123456789abc" }),
    __metadata("design:type", String)
], SessionUserDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "로그인 이메일", example: "user@example.com" }),
    __metadata("design:type", String)
], SessionUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "서비스 표시 이름", example: "홍길동", nullable: true }),
    __metadata("design:type", Object)
], SessionUserDto.prototype, "displayName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "인증 제공자", example: "google" }),
    __metadata("design:type", String)
], SessionUserDto.prototype, "authProvider", void 0);
class SessionProfileDto {
    realName;
    gender;
    ageRange;
    country;
    city;
}
exports.SessionProfileDto = SessionProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 이름", example: "홍길동", nullable: true }),
    __metadata("design:type", Object)
], SessionProfileDto.prototype, "realName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 성별", example: "남성", nullable: true }),
    __metadata("design:type", Object)
], SessionProfileDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 나이대", example: "30대", nullable: true }),
    __metadata("design:type", Object)
], SessionProfileDto.prototype, "ageRange", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "활동 국가", example: "대한민국", nullable: true }),
    __metadata("design:type", Object)
], SessionProfileDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "활동 도시", example: "서울특별시", nullable: true }),
    __metadata("design:type", Object)
], SessionProfileDto.prototype, "city", void 0);
class SessionResponseDto {
    isAuthenticated;
    expiresAt;
    profileComplete;
    user;
    profile;
}
exports.SessionResponseDto = SessionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "로그인 여부", example: true }),
    __metadata("design:type", Boolean)
], SessionResponseDto.prototype, "isAuthenticated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "세션 만료 시각",
        example: "2026-04-27T00:00:00.000Z",
        nullable: true,
    }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "expiresAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "필수 프로필 정보 입력 완료 여부", example: false }),
    __metadata("design:type", Boolean)
], SessionResponseDto.prototype, "profileComplete", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "현재 사용자 정보",
        type: SessionUserDto,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "user", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "현재 프로필 정보",
        type: SessionProfileDto,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "profile", void 0);
