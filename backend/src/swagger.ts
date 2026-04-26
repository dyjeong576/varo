import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: NestExpressApplication, configService: ConfigService): void {
  const appEnv =
    configService.get<string>("appEnv") ??
    configService.get<string>("APP_ENV");

  if (appEnv !== "dev") {
    return;
  }

  const appName = configService.get<string>("appName", "VARO");
  const appTagline = configService.get<string>("appTagline", "Verified Analysis, Reasoned Opinion");
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(`${appName} 백엔드 API 문서`)
      .setDescription(
        `${appName} (${appTagline})의 구글 로그인, 세션, 사용자 프로필 관련 API를 설명하는 개발용 문서입니다.`,
      )
      .setVersion("1.0.0")
      .addCookieAuth("varo_session", {
        type: "apiKey",
        in: "cookie",
        name: configService.get<string>("SESSION_COOKIE_NAME", "varo_session"),
        description: "로그인 성공 후 발급되는 세션 쿠키",
      })
      .build(),
  );

  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: `${appName} API 문서`,
  });
}
