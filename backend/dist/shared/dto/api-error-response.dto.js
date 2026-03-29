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
exports.ApiErrorResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ApiErrorResponseDto {
    statusCode;
    code;
    message;
    traceId;
    timestamp;
    path;
}
exports.ApiErrorResponseDto = ApiErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "HTTP 상태 코드", example: 401 }),
    __metadata("design:type", Number)
], ApiErrorResponseDto.prototype, "statusCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "도메인 에러 코드", example: "AUTH_REQUIRED" }),
    __metadata("design:type", String)
], ApiErrorResponseDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "사용자 노출 메시지", example: "로그인이 필요합니다." }),
    __metadata("design:type", String)
], ApiErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "추적용 trace id", example: "c3f9f22b-2400-4d51-9f4c-111111111111" }),
    __metadata("design:type", String)
], ApiErrorResponseDto.prototype, "traceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "에러 발생 시각", example: "2026-03-27T12:00:00.000Z" }),
    __metadata("design:type", String)
], ApiErrorResponseDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "요청 경로", example: "/api/v1/users/me" }),
    __metadata("design:type", String)
], ApiErrorResponseDto.prototype, "path", void 0);
