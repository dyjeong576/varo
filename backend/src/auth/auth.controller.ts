import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { SessionResponseDto } from "./dto/session-response.dto";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import { buildFrontendRedirectUrl } from "../config/app.config";

@ApiTags("인증 / 세션")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  @Get("google")
  @ApiOperation({
    summary: "구글 로그인 시작",
    description: "구글 OAuth 로그인 페이지로 이동합니다.",
  })
  @ApiQuery({
    name: "redirectTo",
    required: false,
    description: "로그인 완료 후 이동할 내부 경로",
    example: "/",
  })
  async startGoogleLogin(
    @Query("redirectTo") redirectTo: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const flow = this.authService.createGoogleAuthFlow(redirectTo);
    this.sessionService.writeOauthStateCookie(response, flow.stateToken);
    response.redirect(flow.authorizeUrl);
  }

  @Get("google/callback")
  @ApiOperation({
    summary: "구글 로그인 콜백 처리",
    description: "구글 인증 완료 후 세션을 발급하고 적절한 화면으로 이동시킵니다.",
  })
  @ApiQuery({ name: "code", required: false, description: "구글 인증 코드" })
  @ApiQuery({ name: "state", required: true, description: "로그인 상태 검증 토큰" })
  @ApiQuery({
    name: "error",
    required: false,
    description: "구글 로그인 취소 또는 실패 코드",
  })
  @ApiUnauthorizedResponse({
    description: "로그인 검증 실패",
    type: ApiErrorResponseDto,
  })
  async handleGoogleCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string,
    @Query("error") error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const frontendBaseUrl = this.getFrontendBaseUrl();

    if (error === "access_denied") {
      this.sessionService.clearOauthStateCookie(response);
      response.redirect(
        buildFrontendRedirectUrl(frontendBaseUrl, "/login?authError=google_access_denied"),
      );
      return;
    }

    try {
      const result = await this.authService.handleGoogleCallback({
        code,
        stateToken: state,
        stateCookie: request.cookies?.[this.sessionService.getOauthStateCookieName()],
      });

      this.sessionService.clearOauthStateCookie(response);
      this.sessionService.writeSessionCookie(response, result.sessionId, result.expiresAt);
      response.redirect(buildFrontendRedirectUrl(frontendBaseUrl, result.redirectTo));
    } catch (authError) {
      this.sessionService.clearOauthStateCookie(response);

      if (
        authError instanceof AppException &&
        authError.code === APP_ERROR_CODES.AUTH_REQUIRED
      ) {
        response.redirect(
          buildFrontendRedirectUrl(frontendBaseUrl, "/login?authError=google_auth_failed"),
        );
        return;
      }

      throw authError;
    }
  }

  @Get("session")
  @ApiOperation({
    summary: "현재 세션 조회",
    description: "현재 브라우저 세션과 프로필 완성 여부를 조회합니다.",
  })
  @ApiOkResponse({
    description: "세션 조회 성공",
    type: SessionResponseDto,
  })
  @ApiCookieAuth("sessionAuth")
  async getSession(@Req() request: Request): Promise<SessionResponseDto> {
    return this.authService.getSessionResponse(request.cookies?.[this.sessionService.getCookieName()]);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "로그아웃",
    description: "현재 세션을 삭제하고 세션 쿠키를 제거합니다.",
  })
  @ApiCookieAuth("sessionAuth")
  @ApiNoContentResponse({ description: "로그아웃 완료" })
  async logout(@Req() request: Request, @Res() response: Response): Promise<void> {
    const sessionId = request.cookies?.[this.sessionService.getCookieName()];

    if (sessionId) {
      await this.sessionService.deleteSession(sessionId);
    }

    this.sessionService.clearSessionCookie(response);
    response.status(HttpStatus.NO_CONTENT).send();
  }

  private getFrontendBaseUrl(): string {
    const frontendBaseUrl =
      this.configService.get<string>("frontendBaseUrl") ??
      this.configService.get<string>("FRONTEND_BASE_URL");

    if (!frontendBaseUrl) {
      throw new Error("FRONTEND_BASE_URL이 설정되지 않았습니다.");
    }

    return frontendBaseUrl;
  }
}
