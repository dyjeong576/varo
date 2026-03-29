"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.setGlobalPrefix("api/v1");
    app.use((0, cookie_parser_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.enableCors({
        origin: configService.get("FRONTEND_BASE_URL"),
        credentials: true,
    });
    if (configService.get("APP_ENV") === "dev") {
        const document = swagger_1.SwaggerModule.createDocument(app, new swagger_1.DocumentBuilder()
            .setTitle("VARO 백엔드 API 문서")
            .setDescription("구글 로그인, 세션, 사용자 프로필 관련 API를 설명하는 개발용 문서입니다.")
            .setVersion("1.0.0")
            .addCookieAuth("varo_session", {
            type: "apiKey",
            in: "cookie",
            name: configService.get("SESSION_COOKIE_NAME", "varo_session"),
            description: "로그인 성공 후 발급되는 세션 쿠키",
        })
            .build());
        swagger_1.SwaggerModule.setup("api/docs", app, document, {
            swaggerOptions: {
                persistAuthorization: true,
            },
            customSiteTitle: "VARO API 문서",
        });
    }
    const port = configService.get("PORT", 4000);
    await app.listen(port);
}
void bootstrap();
