import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const appName = configService.get<string>("appName", "VARO");
  const appTagline = configService.get<string>("appTagline", "Verified Analysis, Reasoned Opinion");

  app.set("trust proxy", 1);
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: configService.get<string>("FRONTEND_BASE_URL"),
    credentials: true,
  });

  if (configService.get<string>("APP_ENV") === "dev") {
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

  const port = configService.get<number>("PORT", 4000);
  await app.listen(port);
}

void bootstrap();
