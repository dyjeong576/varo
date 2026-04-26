import { ConfigService } from "@nestjs/config";
import { SwaggerModule } from "@nestjs/swagger";
import { setupSwagger } from "./swagger";

describe("setupSwagger", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("prod 환경에서는 Swagger UI를 노출하지 않는다", () => {
    const createDocumentSpy = jest.spyOn(SwaggerModule, "createDocument");
    const setupSpy = jest.spyOn(SwaggerModule, "setup");
    const app = {} as never;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "prod";
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    setupSwagger(app, configService);

    expect(createDocumentSpy).not.toHaveBeenCalled();
    expect(setupSpy).not.toHaveBeenCalled();
  });

  it("dev 환경에서는 /api/docs Swagger UI를 설정한다", () => {
    const document = { openapi: "3.0.0" } as never;
    jest.spyOn(SwaggerModule, "createDocument").mockReturnValue(document);
    const setupSpy = jest.spyOn(SwaggerModule, "setup").mockImplementation();
    const app = {} as never;
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === "appEnv" || key === "APP_ENV") {
          return "dev";
        }

        if (key === "SESSION_COOKIE_NAME") {
          return "varo_session";
        }

        return fallback;
      }),
    } as unknown as ConfigService;

    setupSwagger(app, configService);

    expect(setupSpy).toHaveBeenCalledWith(
      "api/docs",
      app,
      document,
      expect.objectContaining({
        customSiteTitle: "VARO API 문서",
      }),
    );
  });
});
