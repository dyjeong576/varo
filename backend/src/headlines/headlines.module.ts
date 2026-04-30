import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { HeadlinesController } from "./headlines.controller";
import { HeadlinesOpenAiClient } from "./headlines-openai.client";
import { HeadlinesRssParserService } from "./headlines-rss-parser.service";
import { HeadlinesScheduler } from "./headlines.scheduler";
import { HeadlinesService } from "./headlines.service";

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [HeadlinesController],
  providers: [
    HeadlinesService,
    HeadlinesRssParserService,
    HeadlinesOpenAiClient,
    HeadlinesScheduler,
  ],
})
export class HeadlinesModule {}
