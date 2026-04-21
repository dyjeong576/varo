import { HttpStatus, Injectable } from "@nestjs/common";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommunityCommentLikeResponseDto } from "./dto/community-comment-like-response.dto";
import { CommunityPostDetailResponseDto } from "./dto/community-post-detail-response.dto";
import { CommunityPostLikeResponseDto } from "./dto/community-post-like-response.dto";
import { CommunityPostSummaryResponseDto } from "./dto/community-post-summary-response.dto";
import { CreateCommunityCommentDto } from "./dto/create-community-comment.dto";
import { CreateCommunityPostDto } from "./dto/create-community-post.dto";
import { UpdateCommunityPostDto } from "./dto/update-community-post.dto";

type CommunityProfileView = {
  realName: string | null;
  gender: string | null;
  ageRange: string | null;
};

type CommunityPostBaseRecord = {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  createdAt: Date;
  user: {
    displayName: string | null;
    profile: CommunityProfileView | null;
  };
  likes: { userId: string; postId: string; createdAt: Date }[];
  _count: {
    comments: number;
    likes: number;
  };
};

type CommunityPostDetailRecord = CommunityPostBaseRecord & {
  comments: {
    id: string;
    postId: string;
    userId: string;
    parentCommentId: string | null;
    content: string;
    createdAt: Date;
    user: {
      displayName: string | null;
      profile: CommunityProfileView | null;
    };
    likes: { commentId: string; userId: string; createdAt: Date }[];
    _count: {
      likes: number;
    };
  }[];
};

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listPosts(userId: string): Promise<CommunityPostSummaryResponseDto[]> {
    const posts = await this.db.communityPost.findMany({
      orderBy: { createdAt: "desc" },
      include: this.getPostListInclude(userId),
    });

    return posts.map((post) => this.toPostSummary(post, userId));
  }

  async getPostDetail(userId: string, postId: string): Promise<CommunityPostDetailResponseDto> {
    const post = await this.findPostOrThrow(postId, userId);

    return this.toPostDetail(post, userId);
  }

  async createPost(
    userId: string,
    profile: {
      realName: string | null;
      gender: string | null;
      ageRange: string | null;
    } | null,
    payload: CreateCommunityPostDto,
  ): Promise<CommunityPostDetailResponseDto> {
    this.ensureCommunityProfile(profile);

    const post = await this.db.communityPost.create({
      data: {
        userId,
        title: payload.title.trim(),
        content: payload.content.trim(),
        category: payload.category,
      },
      include: this.getPostDetailInclude(userId),
    });

    return this.toPostDetail(post, userId);
  }

  async updatePost(
    userId: string,
    postId: string,
    payload: UpdateCommunityPostDto,
  ): Promise<CommunityPostDetailResponseDto> {
    await this.ensurePostAuthor(userId, postId);

    const data: Record<string, string> = {};

    if (payload.category) {
      data.category = payload.category;
    }

    if (payload.title) {
      data.title = payload.title.trim();
    }

    if (payload.content) {
      data.content = payload.content.trim();
    }

    const post = await this.db.communityPost.update({
      where: { id: postId },
      data,
      include: this.getPostDetailInclude(userId),
    });

    return this.toPostDetail(post, userId);
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    await this.ensurePostAuthor(userId, postId);
    await this.db.communityPost.delete({
      where: { id: postId },
    });
  }

  async createComment(
    userId: string,
    profile: {
      realName: string | null;
      gender: string | null;
      ageRange: string | null;
    } | null,
    postId: string,
    payload: CreateCommunityCommentDto,
  ): Promise<CommunityPostDetailResponseDto> {
    this.ensureCommunityProfile(profile);
    const post = await this.findPostTargetOrThrow(postId);
    let parentCommentAuthorUserId: string | null = null;

    if (payload.parentCommentId) {
      const parentComment = await this.findCommentTargetOrThrow(
        postId,
        payload.parentCommentId,
      );

      parentCommentAuthorUserId = parentComment.userId;
    }

    await this.db.communityComment.create({
      data: {
        postId,
        userId,
        content: payload.content.trim(),
        parentCommentId: payload.parentCommentId ?? null,
      },
    });
    await this.notificationsService.createCommunityCommentNotifications({
      actorUserId: userId,
      postId,
      postTitle: post.title,
      postAuthorUserId: post.userId,
      parentCommentAuthorUserId,
    });

    return this.getPostDetail(userId, postId);
  }

  async deleteComment(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<CommunityPostDetailResponseDto> {
    await this.ensureCommentAuthor(userId, postId, commentId);

    await this.db.communityComment.delete({
      where: { id: commentId },
    });

    return this.getPostDetail(userId, postId);
  }

  async addCommentLike(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<CommunityCommentLikeResponseDto> {
    const comment = await this.findCommentTargetOrThrow(postId, commentId);
    const existingLike = await this.db.communityCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });

    if (!existingLike) {
      await this.db.communityCommentLike.create({
        data: {
          commentId,
          userId,
        },
      });
      await this.notificationsService.createCommunityLikeNotification({
        actorUserId: userId,
        postId,
        postTitle: comment.post.title,
        targetUserId: comment.userId,
        targetKind: "comment",
      });
    }

    return this.getCommentLikeState(userId, commentId);
  }

  async removeCommentLike(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<CommunityCommentLikeResponseDto> {
    await this.ensureCommentExists(postId, commentId);

    await this.db.communityCommentLike.deleteMany({
      where: {
        commentId,
        userId,
      },
    });

    return this.getCommentLikeState(userId, commentId);
  }

  async addLike(userId: string, postId: string): Promise<CommunityPostLikeResponseDto> {
    const post = await this.findPostTargetOrThrow(postId);
    const existingLike = await this.db.communityPostLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (!existingLike) {
      await this.db.communityPostLike.create({
        data: {
          postId,
          userId,
        },
      });
      await this.notificationsService.createCommunityLikeNotification({
        actorUserId: userId,
        postId,
        postTitle: post.title,
        targetUserId: post.userId,
        targetKind: "post",
      });
    }

    return this.getLikeState(userId, postId);
  }

  async removeLike(userId: string, postId: string): Promise<CommunityPostLikeResponseDto> {
    await this.ensurePostExists(postId);

    await this.db.communityPostLike.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    return this.getLikeState(userId, postId);
  }

  private async getLikeState(
    userId: string,
    postId: string,
  ): Promise<CommunityPostLikeResponseDto> {
    const [likeCount, existingLike] = await this.db.$transaction([
      this.db.communityPostLike.count({
        where: { postId },
      }),
      this.db.communityPostLike.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      }),
    ]);

    return {
      likeCount,
      likedByMe: Boolean(existingLike),
    };
  }

  private async getCommentLikeState(
    userId: string,
    commentId: string,
  ): Promise<CommunityCommentLikeResponseDto> {
    const [likeCount, existingLike] = await this.db.$transaction([
      this.db.communityCommentLike.count({
        where: { commentId },
      }),
      this.db.communityCommentLike.findUnique({
        where: {
          commentId_userId: {
            commentId,
            userId,
          },
        },
      }),
    ]);

    return {
      likeCount,
      likedByMe: Boolean(existingLike),
    };
  }

  private async findPostOrThrow(postId: string, userId: string): Promise<CommunityPostDetailRecord> {
    const post = await this.db.communityPost.findUnique({
      where: { id: postId },
      include: this.getPostDetailInclude(userId),
    });

    if (!post) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "게시글을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    return post;
  }

  private async ensurePostExists(postId: string): Promise<void> {
    const post = await this.findPostTargetOrThrow(postId);

    void post;
  }

  private async ensureCommentExists(postId: string, commentId: string): Promise<void> {
    const comment = await this.findCommentTargetOrThrow(postId, commentId);

    void comment;
  }

  private async findPostTargetOrThrow(postId: string): Promise<{
    id: string;
    userId: string;
    title: string;
  }> {
    const post = await this.db.communityPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        title: true,
      },
    });

    if (!post) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "게시글을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    return post;
  }

  private async findCommentTargetOrThrow(
    postId: string,
    commentId: string,
  ): Promise<{
    id: string;
    postId: string;
    userId: string;
    post: {
      title: string;
    };
  }> {
    const comment = await this.db.communityComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        userId: true,
        post: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!comment || comment.postId !== postId) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "댓글을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    return comment;
  }

  private async ensureCommentAuthor(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<void> {
    const comment = await this.db.communityComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        userId: true,
      },
    });

    if (!comment || comment.postId !== postId) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "댓글을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    if (comment.userId !== userId) {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "본인이 작성한 댓글만 삭제할 수 있습니다.",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async ensurePostAuthor(userId: string, postId: string): Promise<void> {
    const post = await this.db.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "게시글을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }

    if (post.userId !== userId) {
      throw new AppException(
        APP_ERROR_CODES.FORBIDDEN,
        "본인이 작성한 게시글만 수정하거나 삭제할 수 있습니다.",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private ensureCommunityProfile(
    profile: {
      realName: string | null;
      gender: string | null;
      ageRange: string | null;
    } | null,
  ): void {
    if (profile?.realName && profile.gender && profile.ageRange) {
      return;
    }

    throw new AppException(
      APP_ERROR_CODES.FORBIDDEN,
      "커뮤니티 활동을 위해서는 실명, 성별, 나이대 프로필이 필요합니다.",
      HttpStatus.FORBIDDEN,
    );
  }

  private getPostListInclude(userId: string) {
    return {
      user: {
        include: {
          profile: true,
        },
      },
      likes: {
        where: { userId },
        select: {
          userId: true,
          postId: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
        },
      },
    };
  }

  private getPostDetailInclude(userId: string) {
    return {
      user: {
        include: {
          profile: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          likes: {
            where: { userId },
            select: {
              commentId: true,
              userId: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              likes: true,
            },
          },
        },
      },
      likes: {
        where: { userId },
        select: {
          userId: true,
          postId: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
        },
      },
    };
  }

  private toPostSummary(
    post: CommunityPostBaseRecord,
    currentUserId: string,
  ): CommunityPostSummaryResponseDto {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      category: this.toCategory(post.category),
      author: {
        name: post.user.profile?.realName ?? post.user.displayName ?? "알 수 없음",
        gender: post.user.profile?.gender ?? "비공개",
        ageGroup: post.user.profile?.ageRange ?? "미설정",
      },
      createdAt: post.createdAt.toISOString(),
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      isAuthor: post.userId === currentUserId,
      likedByMe: post.likes.length > 0,
    };
  }

  private toPostDetail(
    post: CommunityPostDetailRecord,
    currentUserId: string,
  ): CommunityPostDetailResponseDto {
    const commentsByParentId = new Map<string | null, CommunityPostDetailResponseDto["comments"]>();

    for (const comment of post.comments) {
      const key = comment.parentCommentId ?? null;
      const siblings = commentsByParentId.get(key) ?? [];
      siblings.push({
        id: comment.id,
        postId: comment.postId,
        parentCommentId: comment.parentCommentId,
        author: {
          name: comment.user.profile?.realName ?? comment.user.displayName ?? "알 수 없음",
          gender: comment.user.profile?.gender ?? "비공개",
          ageGroup: comment.user.profile?.ageRange ?? "미설정",
        },
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        isAuthor: comment.userId === currentUserId,
        likeCount: comment._count.likes,
        likedByMe: comment.likes.length > 0,
        replies: [],
      });
      commentsByParentId.set(key, siblings);
    }

    const buildReplies = (parentCommentId: string | null) =>
      (commentsByParentId.get(parentCommentId) ?? []).map((comment) => ({
        ...comment,
        replies: buildReplies(comment.id),
      }));

    return {
      ...this.toPostSummary(post, currentUserId),
      comments: buildReplies(null),
    };
  }

  private toCategory(category: string): "Issue" | "Policy" | "FactCheck" {
    if (category === "Issue" || category === "Policy" || category === "FactCheck") {
      return category;
    }

    return "Issue";
  }
}
