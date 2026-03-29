import { HttpException, HttpStatus } from "@nestjs/common";
import type { AppErrorCode } from "../constants/app-error-codes";

export class AppException extends HttpException {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}
