"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const app_error_codes_1 = require("../constants/app-error-codes");
const app_exception_1 = require("../exceptions/app-exception");
let AllExceptionsFilter = class AllExceptionsFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const traceId = request.traceId ?? (0, node_crypto_1.randomUUID)();
        if (exception instanceof app_exception_1.AppException) {
            response.status(exception.getStatus()).json({
                statusCode: exception.getStatus(),
                code: exception.code,
                message: exception.message,
                details: exception.details,
                traceId,
                timestamp: new Date().toISOString(),
                path: request.url,
            });
            return;
        }
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            const message = typeof exceptionResponse === "object" && exceptionResponse !== null
                ? exceptionResponse.message
                : exception.message;
            const normalizedMessage = Array.isArray(message) ? message.join(", ") : message;
            const code = status === common_1.HttpStatus.UNAUTHORIZED
                ? app_error_codes_1.APP_ERROR_CODES.AUTH_REQUIRED
                : status === common_1.HttpStatus.FORBIDDEN
                    ? app_error_codes_1.APP_ERROR_CODES.FORBIDDEN
                    : app_error_codes_1.APP_ERROR_CODES.INPUT_VALIDATION_ERROR;
            response.status(status).json({
                statusCode: status,
                code,
                message: normalizedMessage,
                traceId,
                timestamp: new Date().toISOString(),
                path: request.url,
            });
            return;
        }
        response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            code: app_error_codes_1.APP_ERROR_CODES.INTERNAL_ERROR,
            message: "서버 내부 오류가 발생했습니다.",
            traceId,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
