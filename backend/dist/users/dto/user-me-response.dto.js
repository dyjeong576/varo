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
exports.UserMeResponseDto = exports.UserProfileDto = exports.UserMeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class UserMeDto {
    id;
    email;
    displayName;
    authProvider;
}
exports.UserMeDto = UserMeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "사용자 식별자", example: "5c47b0f3-11c0-4ec6-8e3a-123456789abc" }),
    __metadata("design:type", String)
], UserMeDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "이메일", example: "user@example.com" }),
    __metadata("design:type", String)
], UserMeDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "서비스 표시 이름", example: "홍길동", nullable: true }),
    __metadata("design:type", Object)
], UserMeDto.prototype, "displayName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "인증 제공자", example: "google" }),
    __metadata("design:type", String)
], UserMeDto.prototype, "authProvider", void 0);
class UserProfileDto {
    realName;
    gender;
    ageRange;
    country;
    city;
}
exports.UserProfileDto = UserProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 이름", example: "홍길동", nullable: true }),
    __metadata("design:type", Object)
], UserProfileDto.prototype, "realName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 성별", example: "남성", nullable: true }),
    __metadata("design:type", Object)
], UserProfileDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 나이대", example: "30대", nullable: true }),
    __metadata("design:type", Object)
], UserProfileDto.prototype, "ageRange", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "활동 국가", example: "대한민국", nullable: true }),
    __metadata("design:type", Object)
], UserProfileDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "활동 도시", example: "서울특별시", nullable: true }),
    __metadata("design:type", Object)
], UserProfileDto.prototype, "city", void 0);
class UserMeResponseDto {
    user;
    profile;
    profileComplete;
}
exports.UserMeResponseDto = UserMeResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "사용자 정보", type: UserMeDto }),
    __metadata("design:type", UserMeDto)
], UserMeResponseDto.prototype, "user", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "프로필 정보", type: UserProfileDto }),
    __metadata("design:type", UserProfileDto)
], UserMeResponseDto.prototype, "profile", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "필수 프로필 정보 입력 완료 여부", example: true }),
    __metadata("design:type", Boolean)
], UserMeResponseDto.prototype, "profileComplete", void 0);
