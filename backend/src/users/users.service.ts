import { HttpStatus, Injectable } from "@nestjs/common";
import type { UserProfile } from "@prisma/client";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { PrismaService } from "../prisma/prisma.service";
import { SessionService } from "../auth/session.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserMeResponseDto } from "./dto/user-me-response.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async getMe(userId: string): Promise<UserMeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "사용자 정보를 찾을 수 없습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        authProvider: user.authProvider,
      },
      profile: {
        realName: user.profile.realName,
        gender: user.profile.gender,
        ageRange: user.profile.ageRange,
        country: user.profile.country,
        city: user.profile.city,
      },
      profileComplete: this.sessionService.getProfileComplete(user.profile),
    };
  }

  async updateProfile(userId: string, payload: UpdateProfileDto): Promise<UserMeResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!existing || !existing.profile) {
      throw new AppException(
        APP_ERROR_CODES.AUTH_REQUIRED,
        "사용자 프로필을 찾을 수 없습니다.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const profile = existing.profile;
    const isComplete = this.sessionService.getProfileComplete(profile);

    if (!isComplete) {
      this.ensureInitialProfilePayload(payload);
    } else {
      this.ensureMutableFieldsOnly(profile, payload);
    }

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        realName: payload.realName ?? undefined,
        gender: payload.gender ?? undefined,
        ageRange: payload.ageRange ?? undefined,
        country: payload.country ?? undefined,
        city: payload.city ?? undefined,
      },
    });

    return {
      user: {
        id: existing.id,
        email: existing.email,
        displayName: existing.displayName,
        authProvider: existing.authProvider,
      },
      profile: {
        realName: updated.realName,
        gender: updated.gender,
        ageRange: updated.ageRange,
        country: updated.country,
        city: updated.city,
      },
      profileComplete: this.sessionService.getProfileComplete(updated),
    };
  }

  private ensureInitialProfilePayload(payload: UpdateProfileDto): void {
    const requiredFields: (keyof UpdateProfileDto)[] = [
      "realName",
      "gender",
      "ageRange",
      "country",
      "city",
    ];

    const missingFields = requiredFields.filter((field) => !payload[field]);

    if (missingFields.length > 0) {
      throw new AppException(
        APP_ERROR_CODES.INPUT_VALIDATION_ERROR,
        "첫 로그인 시에는 이름, 성별, 나이대, 국가, 도시를 모두 입력해야 합니다.",
        HttpStatus.BAD_REQUEST,
        { missingFields },
      );
    }
  }

  private ensureMutableFieldsOnly(profile: UserProfile, payload: UpdateProfileDto): void {
    if (payload.realName && payload.realName !== profile.realName) {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "이름은 최초 설정 이후 수정할 수 없습니다.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (payload.gender && payload.gender !== profile.gender) {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "성별은 최초 설정 이후 수정할 수 없습니다.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (payload.ageRange && payload.ageRange !== profile.ageRange) {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "나이대는 최초 설정 이후 수정할 수 없습니다.",
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
