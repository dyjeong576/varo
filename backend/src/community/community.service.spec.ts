import { HttpStatus } from "@nestjs/common";
import { CommunityService } from "./community.service";
describe("CommunityService", () => {
  function createService() {
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
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      communityCommentLike: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    return {
      prisma,
      service: new CommunityService(prisma as never),
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
    const { service, prisma } = createService();
    prisma.communityPost.findUnique.mockResolvedValueOnce({ id: "post-1" });
    prisma.$transaction.mockResolvedValue([3, { postId: "post-1", userId: "user-1" }]);

    const result = await service.addLike("user-1", "post-1");

    expect(prisma.communityPostLike.upsert).toHaveBeenCalled();
    expect(result).toEqual({
      likeCount: 3,
      likedByMe: true,
    });
  });

  it("댓글 좋아요 추가 후 상태를 반환한다", async () => {
    const { service, prisma } = createService();
    prisma.communityComment.findUnique.mockResolvedValue({
      id: "comment-1",
      postId: "post-1",
    });
    prisma.$transaction.mockResolvedValue([2, { commentId: "comment-1", userId: "user-1" }]);

    const result = await service.addCommentLike("user-1", "post-1", "comment-1");

    expect(prisma.communityCommentLike.upsert).toHaveBeenCalled();
    expect(result).toEqual({
      likeCount: 2,
      likedByMe: true,
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
