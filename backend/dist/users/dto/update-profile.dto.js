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
exports.UpdateProfileDto = exports.CompleteProfileDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CompleteProfileDto {
    realName;
    gender;
    ageRange;
    country;
    city;
}
exports.CompleteProfileDto = CompleteProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 이름", example: "홍길동" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CompleteProfileDto.prototype, "realName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 성별", example: "남성" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(["남성", "여성", "기타", "응답 안 함"]),
    __metadata("design:type", String)
], CompleteProfileDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "공개 나이대", example: "30대" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(["10대", "20대", "30대", "40대", "50대", "60대 이상"]),
    __metadata("design:type", String)
], CompleteProfileDto.prototype, "ageRange", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "활동 국가", example: "대한민국" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CompleteProfileDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "활동 도시", example: "서울특별시" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CompleteProfileDto.prototype, "city", void 0);
class UpdateProfileDto extends (0, swagger_1.PartialType)(CompleteProfileDto) {
    realName;
    gender;
    ageRange;
    country;
    city;
}
exports.UpdateProfileDto = UpdateProfileDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "공개 이름", example: "홍길동" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "realName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "공개 성별", example: "남성" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(["남성", "여성", "기타", "응답 안 함"]),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "공개 나이대", example: "30대" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(["10대", "20대", "30대", "40대", "50대", "60대 이상"]),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "ageRange", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "활동 국가", example: "대한민국" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "활동 도시", example: "서울특별시" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "city", void 0);
