import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleOAuthService } from "./google-oauth.service";
import { SessionService } from "./session.service";

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleOAuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
