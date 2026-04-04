import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PopularController } from "./popular.controller";
import { PopularService } from "./popular.service";

@Module({
  imports: [AuthModule],
  controllers: [PopularController],
  providers: [PopularService],
  exports: [PopularService],
})
export class PopularModule {}
