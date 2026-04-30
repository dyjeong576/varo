import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { CommunityModule } from "./community/community.module";
import { TraceIdMiddleware } from "./common/middleware/trace-id.middleware";
import { HeadlinesModule } from "./headlines/headlines.module";
import { HealthModule } from "./health/health.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PopularModule } from "./popular/popular.module";
import { getAppConfig } from "./config/app.config";
import { PrismaModule } from "./prisma/prisma.module";
import { AnswersModule } from "./answers/answers.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [getAppConfig],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    AnswersModule,
    HeadlinesModule,
    CommunityModule,
    NotificationsModule,
    PopularModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceIdMiddleware).forRoutes("*");
  }
}
