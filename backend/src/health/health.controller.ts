import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthResponseDto } from "./dto/health-response.dto";
import { HealthService } from "./health.service";

@ApiTags("헬스체크")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "백엔드 헬스체크",
    description: "애플리케이션과 PostgreSQL 연결 상태를 확인합니다.",
  })
  @ApiOkResponse({
    description: "헬스체크 성공",
    type: HealthResponseDto,
  })
  async getHealth(): Promise<HealthResponseDto> {
    return this.healthService.getHealth();
  }
}
