import { HttpStatus } from "@nestjs/common";
import { CommunityService } from "./community.service";
describe("CommunityService", () => {
  function createService() {
    const notificationsService = {
      createCommunityCommentNotifications: jest.fn().mockResolvedValue(undefined),
      createCommunityLikeNotification: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      communityPost: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      communityComment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      communityPostLike: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      communityCommentLike: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    return {
      prisma,
      notificationsService,
      service: new CommunityService(prisma as never, notificationsService as never),
    };
  }

  it("프로필 정보가 없으면 게시글 작성을 차단한다", async () => {
    const { service } = createService();

    await expect(
      service.createPost(
        "user-1",
        {
          realName: null,
          gender: "남성",
          ageRange: "30대",
        },
        {
          category: "Issue",
          title: "제목",
          content: "본문",
        },
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it("본인 게시글이 아니면 수정할 수 없다", async () => {
    const { service, prisma } = createService();
    prisma.communityPost.findUnique.mockResolvedValue({
      id: "post-1",
      userId: "other-user",
    });

    await expect(
      service.updatePost("user-1", "post-1", {
        title: "새 제목",
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it("공감 추가 후 like 상태를 반환한다", async () => {
    const { service, prisma, notificationsService } = createService();
    prisma.communityPost.findUnique
      .mockResolvedValueOnce({ id: "post-1", userId: "author-1", title: "테스트 글" });
    prisma.communityPostLike.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([3, { postId: "post-1", userId: "user-1" }]);

    const result = await service.addLike("user-1", "post-1");

    expect(prisma.communityPostLike.create).toHaveBeenCalled();
    expect(notificationsService.createCommunityLikeNotification).toHaveBeenCalledWith({
      actorUserId: "user-1",
      postId: "post-1",
      postTitle: "테스트 글",
      targetUserId: "author-1",
      targetKind: "post",
    });
    expect(result).toEqual({
      likeCount: 3,
      likedByMe: true,
    });
  });

  it("댓글 좋아요 추가 후 상태를 반환한다", async () => {
    const { service, prisma, notificationsService } = createService();
    prisma.communityComment.findUnique.mockResolvedValue({
      id: "comment-1",
      postId: "post-1",
      userId: "author-2",
      post: {
        title: "댓글 대상 글",
      },
    });
    prisma.communityCommentLike.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([2, { commentId: "comment-1", userId: "user-1" }]);

    const result = await service.addCommentLike("user-1", "post-1", "comment-1");

    expect(prisma.communityCommentLike.create).toHaveBeenCalled();
    expect(notificationsService.createCommunityLikeNotification).toHaveBeenCalledWith({
      actorUserId: "user-1",
      postId: "post-1",
      postTitle: "댓글 대상 글",
      targetUserId: "author-2",
      targetKind: "comment",
    });
    expect(result).toEqual({
      likeCount: 2,
      likedByMe: true,
    });
  });

  it("대댓글 작성 시 게시글 작성자와 부모 댓글 작성자에게 알림을 요청한다", async () => {
    const { service, prisma, notificationsService } = createService();
    prisma.communityPost.findUnique
      .mockResolvedValueOnce({
        id: "post-1",
        userId: "post-author",
        title: "알림 테스트",
      })
      .mockResolvedValueOnce({
        id: "post-1",
        userId: "post-author",
        title: "알림 테스트",
        content: "본문",
        category: "Issue",
        createdAt: new Date("2026-04-19T12:00:00.000Z"),
        user: {
          displayName: "글쓴이",
          profile: {
            realName: "글쓴이",
            gender: "남성",
            ageRange: "30대",
          },
        },
        comments: [],
        likes: [],
        _count: {
          comments: 0,
          likes: 0,
        },
      });
    prisma.communityComment.findUnique.mockResolvedValueOnce({
      id: "comment-1",
      postId: "post-1",
      userId: "parent-author",
      post: {
        title: "알림 테스트",
      },
    });

    await service.createComment(
      "user-1",
      {
        realName: "홍길동",
        gender: "남성",
        ageRange: "30대",
      },
      "post-1",
      {
        content: "대댓글입니다.",
        parentCommentId: "comment-1",
      },
    );

    expect(notificationsService.createCommunityCommentNotifications).toHaveBeenCalledWith({
      actorUserId: "user-1",
      postId: "post-1",
      postTitle: "알림 테스트",
      postAuthorUserId: "post-author",
      parentCommentAuthorUserId: "parent-author",
    });
  });

  it("본인 댓글이 아니면 삭제할 수 없다", async () => {
    const { service, prisma } = createService();
    prisma.communityComment.findUnique.mockResolvedValue({
      id: "comment-1",
      postId: "post-1",
      userId: "other-user",
    });

    await expect(
      service.deleteComment("user-1", "post-1", "comment-1"),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });
});
