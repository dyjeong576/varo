import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { ApiErrorResponseDto } from "../shared/dto/api-error-response.dto";
import { CommunityPostDetailResponseDto } from "./dto/community-post-detail-response.dto";
import { CommunityCommentLikeResponseDto } from "./dto/community-comment-like-response.dto";
import { CommunityPostLikeResponseDto } from "./dto/community-post-like-response.dto";
import { CommunityPostSummaryResponseDto } from "./dto/community-post-summary-response.dto";
import { CreateCommunityCommentDto } from "./dto/create-community-comment.dto";
import { CreateCommunityPostDto } from "./dto/create-community-post.dto";
import { UpdateCommunityPostDto } from "./dto/update-community-post.dto";
import { CommunityService } from "./community.service";

@ApiTags("커뮤니티")
@ApiCookieAuth("sessionAuth")
@UseGuards(SessionAuthGuard)
@Controller("community/posts")
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get()
  @ApiOperation({
    summary: "커뮤니티 게시글 목록 조회",
    description: "커뮤니티 피드에 노출할 게시글 목록을 최신순으로 반환합니다.",
  })
  @ApiOkResponse({
    description: "커뮤니티 게시글 목록 조회 성공",
    type: CommunityPostSummaryResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  async listPosts(
    @CurrentUser() current: { user: { id: string } },
  ): Promise<CommunityPostSummaryResponseDto[]> {
    return this.communityService.listPosts(current.user.id);
  }

  @Get(":postId")
  @ApiOperation({
    summary: "커뮤니티 게시글 상세 조회",
    description: "게시글 본문과 댓글 목록을 함께 반환합니다.",
  })
  @ApiOkResponse({
    description: "커뮤니티 게시글 상세 조회 성공",
    type: CommunityPostDetailResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async getPostDetail(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
  ): Promise<CommunityPostDetailResponseDto> {
    return this.communityService.getPostDetail(current.user.id, postId);
  }

  @Post()
  @ApiOperation({
    summary: "커뮤니티 게시글 작성",
    description: "실명, 성별, 나이대 프로필이 준비된 사용자가 게시글을 작성합니다.",
  })
  @ApiBody({ type: CreateCommunityPostDto })
  @ApiOkResponse({
    description: "커뮤니티 게시글 작성 성공",
    type: CommunityPostDetailResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "커뮤니티 활동에 필요한 프로필이 준비되지 않음",
    type: ApiErrorResponseDto,
  })
  async createPost(
    @CurrentUser()
    current: {
      user: { id: string };
      profile: { realName: string | null; gender: string | null; ageRange: string | null } | null;
    },
    @Body() payload: CreateCommunityPostDto,
  ): Promise<CommunityPostDetailResponseDto> {
    return this.communityService.createPost(current.user.id, current.profile, payload);
  }

  @Patch(":postId")
  @ApiOperation({
    summary: "커뮤니티 게시글 수정",
    description: "본인이 작성한 게시글만 수정할 수 있습니다.",
  })
  @ApiBody({ type: UpdateCommunityPostDto })
  @ApiOkResponse({
    description: "커뮤니티 게시글 수정 성공",
    type: CommunityPostDetailResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "본인 게시글이 아니거나 프로필 조건을 만족하지 않음",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async updatePost(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
    @Body() payload: UpdateCommunityPostDto,
  ): Promise<CommunityPostDetailResponseDto> {
    return this.communityService.updatePost(current.user.id, postId, payload);
  }

  @Delete(":postId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "커뮤니티 게시글 삭제",
    description: "본인이 작성한 게시글만 삭제할 수 있습니다.",
  })
  @ApiNoContentResponse({
    description: "커뮤니티 게시글 삭제 성공",
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "본인 게시글이 아니거나 삭제 권한이 없음",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async deletePost(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
  ): Promise<void> {
    await this.communityService.deletePost(current.user.id, postId);
  }

  @Post(":postId/comments")
  @ApiOperation({
    summary: "커뮤니티 댓글 작성",
    description: "게시글에 댓글을 작성하고 갱신된 상세 데이터를 반환합니다.",
  })
  @ApiBody({ type: CreateCommunityCommentDto })
  @ApiOkResponse({
    description: "커뮤니티 댓글 작성 성공",
    type: CommunityPostDetailResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "커뮤니티 활동에 필요한 프로필이 준비되지 않음",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async createComment(
    @CurrentUser()
    current: {
      user: { id: string };
      profile: { realName: string | null; gender: string | null; ageRange: string | null } | null;
    },
    @Param("postId") postId: string,
    @Body() payload: CreateCommunityCommentDto,
  ): Promise<CommunityPostDetailResponseDto> {
    return this.communityService.createComment(current.user.id, current.profile, postId, payload);
  }

  @Delete(":postId/comments/:commentId")
  @ApiOperation({
    summary: "커뮤니티 댓글 삭제",
    description: "본인이 작성한 댓글만 삭제할 수 있으며, 삭제 후 갱신된 게시글 상세를 반환합니다.",
  })
  @ApiOkResponse({
    description: "커뮤니티 댓글 삭제 성공",
    type: CommunityPostDetailResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: "본인 댓글이 아니거나 삭제 권한이 없음",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 댓글 또는 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async deleteComment(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
    @Param("commentId") commentId: string,
  ): Promise<CommunityPostDetailResponseDto> {
    return this.communityService.deleteComment(current.user.id, postId, commentId);
  }

  @Post(":postId/comments/:commentId/likes")
  @ApiOperation({
    summary: "댓글 좋아요 추가",
    description: "현재 사용자의 댓글 좋아요를 추가합니다.",
  })
  @ApiOkResponse({
    description: "댓글 좋아요 추가 성공",
    type: CommunityCommentLikeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 댓글 또는 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async addCommentLike(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
    @Param("commentId") commentId: string,
  ): Promise<CommunityCommentLikeResponseDto> {
    return this.communityService.addCommentLike(current.user.id, postId, commentId);
  }

  @Delete(":postId/comments/:commentId/likes")
  @ApiOperation({
    summary: "댓글 좋아요 취소",
    description: "현재 사용자의 댓글 좋아요를 취소합니다.",
  })
  @ApiOkResponse({
    description: "댓글 좋아요 취소 성공",
    type: CommunityCommentLikeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 댓글 또는 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async removeCommentLike(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
    @Param("commentId") commentId: string,
  ): Promise<CommunityCommentLikeResponseDto> {
    return this.communityService.removeCommentLike(current.user.id, postId, commentId);
  }

  @Post(":postId/likes")
  @ApiOperation({
    summary: "게시글 공감 추가",
    description: "현재 사용자의 게시글 공감을 추가합니다.",
  })
  @ApiOkResponse({
    description: "게시글 공감 추가 성공",
    type: CommunityPostLikeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async addLike(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
  ): Promise<CommunityPostLikeResponseDto> {
    return this.communityService.addLike(current.user.id, postId);
  }

  @Delete(":postId/likes")
  @ApiOperation({
    summary: "게시글 공감 취소",
    description: "현재 사용자의 게시글 공감을 취소합니다.",
  })
  @ApiOkResponse({
    description: "게시글 공감 취소 성공",
    type: CommunityPostLikeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "세션이 없거나 만료됨",
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "해당 게시글을 찾을 수 없음",
    type: ApiErrorResponseDto,
  })
  async removeLike(
    @CurrentUser() current: { user: { id: string } },
    @Param("postId") postId: string,
  ): Promise<CommunityPostLikeResponseDto> {
    return this.communityService.removeLike(current.user.id, postId);
  }
}
