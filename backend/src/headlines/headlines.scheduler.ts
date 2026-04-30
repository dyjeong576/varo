import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { HeadlinesService } from "./headlines.service";

@Injectable()
export class HeadlinesScheduler {
  private readonly logger = new Logger(HeadlinesScheduler.name);

  constructor(private readonly headlinesService: HeadlinesService) {}

  @Cron("0 0 1 * * *", { timeZone: "Asia/Seoul" })
  async scrapeDailyHeadlines(): Promise<void> {
    try {
      await this.headlinesService.scrapeHeadlines("cron");
    } catch (error) {
      this.logger.error(
        `daily headline scrape failed: ${error instanceof Error ? error.message : "unknown error"}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
