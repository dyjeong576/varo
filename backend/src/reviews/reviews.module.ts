import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReviewsOpenAiClient } from "./providers/reviews-openai.client";
import { ReviewsTavilyClient } from "./providers/reviews-tavily.client";
import { ReviewsQueryPreviewPersistenceService } from "./query-preview/reviews-query-preview.persistence.service";
import { ReviewsQueryPreviewService } from "./query-preview/reviews-query-preview.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewsProvidersService } from "./reviews.providers.service";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [ConfigModule, AuthModule, NotificationsModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsOpenAiClient,
    ReviewsTavilyClient,
    ReviewsProvidersService,
    ReviewsQueryPreviewPersistenceService,
    ReviewsQueryPreviewService,
    ReviewsService,
  ],
  exports: [ReviewsService],
})
export class ReviewsModule {}
