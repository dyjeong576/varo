import { HttpStatus } from "@nestjs/common";
import { APP_ERROR_CODES } from "../../common/constants/app-error-codes";
import { AppException } from "../../common/exceptions/app-exception";

export async function postJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  errorCode: (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES],
  errorMessage: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AppException(errorCode, errorMessage, HttpStatus.BAD_GATEWAY, {
      cause: error instanceof Error ? error.message : "unknown",
    });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    throw new AppException(errorCode, errorMessage, HttpStatus.BAD_GATEWAY, {
      status: response.status,
      body: errorText.slice(0, 1000),
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new AppException(
      errorCode,
      `${errorMessage} 응답 JSON 파싱에 실패했습니다.`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
