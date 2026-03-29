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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const session_auth_guard_1 = require("../common/guards/session-auth.guard");
const api_error_response_dto_1 = require("../shared/dto/api-error-response.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const user_me_response_dto_1 = require("./dto/user-me-response.dto");
const users_service_1 = require("./users.service");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async getMe(current) {
        return this.usersService.getMe(current.user.id);
    }
    async updateMyProfile(current, payload) {
        return this.usersService.updateProfile(current.user.id, payload);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)("me"),
    (0, swagger_1.ApiOperation)({
        summary: "현재 사용자 조회",
        description: "로그인한 사용자의 계정 정보와 프로필 완성 여부를 조회합니다.",
    }),
    (0, swagger_1.ApiOkResponse)({
        description: "현재 사용자 조회 성공",
        type: user_me_response_dto_1.UserMeResponseDto,
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({
        description: "세션이 없거나 만료됨",
        type: api_error_response_dto_1.ApiErrorResponseDto,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)("me/profile"),
    (0, swagger_1.ApiOperation)({
        summary: "현재 사용자 프로필 수정",
        description: "첫 로그인 시에는 이름, 성별, 나이대, 국가, 도시를 모두 입력해야 하며 이후에는 국가와 도시만 수정할 수 있습니다.",
    }),
    (0, swagger_1.ApiBody)({ type: update_profile_dto_1.UpdateProfileDto }),
    (0, swagger_1.ApiOkResponse)({
        description: "프로필 저장 성공",
        type: user_me_response_dto_1.UserMeResponseDto,
    }),
    (0, swagger_1.ApiForbiddenResponse)({
        description: "수정할 수 없는 필드를 변경하려는 경우",
        type: api_error_response_dto_1.ApiErrorResponseDto,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateMyProfile", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)("사용자 / 프로필"),
    (0, swagger_1.ApiCookieAuth)("sessionAuth"),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    (0, common_1.Controller)("users"),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
