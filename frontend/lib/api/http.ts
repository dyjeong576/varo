export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface RequestOptions extends RequestInit {
  skipJson?: boolean;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = "요청 처리에 실패했습니다.";
    let errorCode: string | undefined;

    try {
      const errorBody = (await response.json()) as { message?: string; code?: string };
      errorMessage = errorBody.message ?? errorMessage;
      errorCode = errorBody.code;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new ApiClientError(errorMessage, response.status, errorCode);
  }

  if (options.skipJson || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
