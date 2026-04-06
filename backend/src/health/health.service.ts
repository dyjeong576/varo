import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { HealthResponseDto } from "./dto/health-response.dto";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResponseDto> {
    await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);

    return {
      status: "ok",
      service: "backend",
      database: true,
      checkedAt: new Date().toISOString(),
    };
  }
}
