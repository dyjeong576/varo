import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { ReviewsController } from "./reviews.controller";
import { ReviewsProvidersService } from "./reviews.providers.service";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsProvidersService, ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
