import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { APP_ERROR_CODES } from "../constants/app-error-codes";
import { AppException } from "../exceptions/app-exception";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();
    const traceId = request.traceId ?? randomUUID();

    this.logException(exception, request.url, traceId);

    if (exception instanceof AppException) {
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

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === "object" && exceptionResponse !== null
          ? (exceptionResponse as { message?: string | string[] }).message
          : exception.message;
      const normalizedMessage = Array.isArray(message) ? message.join(", ") : message;
      const code =
        status === HttpStatus.UNAUTHORIZED
          ? APP_ERROR_CODES.AUTH_REQUIRED
          : status === HttpStatus.FORBIDDEN
            ? APP_ERROR_CODES.FORBIDDEN
            : APP_ERROR_CODES.INPUT_VALIDATION_ERROR;

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

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: APP_ERROR_CODES.INTERNAL_ERROR,
      message: "서버 내부 오류가 발생했습니다.",
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private logException(exception: unknown, path: string, traceId: string): void {
    if (exception instanceof AppException) {
      this.logger.error(
        `[${traceId}] ${exception.code} ${exception.message} path=${path} details=${JSON.stringify(
          exception.details ?? {},
        )}`,
        exception.stack,
      );
      return;
    }

    if (exception instanceof HttpException) {
      this.logger.error(
        `[${traceId}] HTTP_EXCEPTION ${exception.message} path=${path}`,
        exception.stack,
      );
      return;
    }

    if (exception instanceof Error) {
      this.logger.error(
        `[${traceId}] UNHANDLED_EXCEPTION ${exception.message} path=${path}`,
        exception.stack,
      );
      return;
    }

    this.logger.error(
      `[${traceId}] UNKNOWN_EXCEPTION path=${path} payload=${JSON.stringify(exception)}`,
    );
  }
}
