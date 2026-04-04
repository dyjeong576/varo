import { ApiProperty } from "@nestjs/swagger";

export class CommunityAuthorResponseDto {
  @ApiProperty({ description: "작성자 실명", example: "김철수" })
  name!: string;

  @ApiProperty({ description: "작성자 공개 성별", example: "남" })
  gender!: string;

  @ApiProperty({ description: "작성자 공개 나이대", example: "30대" })
  ageGroup!: string;
}
