import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AnswersNaverClient } from "./providers/answers-naver.client";
import { AnswersOpenAiClient } from "./providers/answers-openai.client";
import { AnswersPerplexityClient } from "./providers/answers-perplexity.client";
import { AnswersTavilyClient } from "./providers/answers-tavily.client";
import { AnswersQueryPreviewPersistenceService } from "./query-preview/answers-query-preview.persistence.service";
import { AnswersQueryPreviewService } from "./query-preview/answers-query-preview.service";
import { AnswersController } from "./answers.controller";
import { AnswersProvidersService } from "./answers.providers.service";
import { AnswersService } from "./answers.service";

@Module({
  imports: [ConfigModule, AuthModule, NotificationsModule],
  controllers: [AnswersController],
  providers: [
    AnswersTavilyClient,
    AnswersNaverClient,
    AnswersOpenAiClient,
    AnswersPerplexityClient,
    AnswersProvidersService,
    AnswersQueryPreviewPersistenceService,
    AnswersQueryPreviewService,
    AnswersService,
  ],
  exports: [AnswersService],
})
export class AnswersModule {}
