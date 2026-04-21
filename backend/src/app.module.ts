import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CommunityModule } from "./community/community.module";
import { TraceIdMiddleware } from "./common/middleware/trace-id.middleware";
import { HealthModule } from "./health/health.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PopularModule } from "./popular/popular.module";
import { getAppConfig } from "./config/app.config";
import { PrismaModule } from "./prisma/prisma.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [getAppConfig],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ReviewsModule,
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
