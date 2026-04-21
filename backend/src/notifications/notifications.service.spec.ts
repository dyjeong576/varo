import { HttpStatus } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  function createService() {
    const prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      notificationRead: {
        upsert: jest.fn(),
        createMany: jest.fn(),
      },
      userNotificationPreference: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    return {
      prisma,
      service: new NotificationsService(prisma as never),
    };
  }

  it("알림 목록과 unread count를 반환한다", async () => {
    const { prisma, service } = createService();
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: "notification-1",
          notificationType: "review_completed",
          title: "근거 수집 완료",
          body: "본문",
          targetType: "review",
          targetId: "review-1",
          createdAt: new Date("2026-04-19T10:00:00.000Z"),
          reads: [],
        },
      ],
      1,
    ]);

    const result = await service.listNotifications("user-1");

    expect(result.unreadCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "notification-1",
      type: "review_completed",
      isRead: false,
      targetType: "review",
      targetId: "review-1",
    });
  });

  it("설정 조회 시 기본 row를 lazy upsert한다", async () => {
    const { prisma, service } = createService();
    prisma.userNotificationPreference.upsert.mockResolvedValue({
      userId: "user-1",
      reviewCompleted: true,
      communityComment: true,
      communityLike: true,
      updatedAt: new Date(),
    });

    const result = await service.getPreferences("user-1");

    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: {},
      create: { userId: "user-1" },
    });
    expect(result).toEqual({
      reviewCompleted: true,
      communityComment: true,
      communityLike: true,
    });
  });

  it("본인 알림만 읽음 처리한다", async () => {
    const { prisma, service } = createService();
    prisma.notification.findFirst.mockResolvedValue({ id: "notification-1" });

    const result = await service.markRead("user-1", "notification-1");

    expect(prisma.notificationRead.upsert).toHaveBeenCalledWith({
      where: {
        notificationId_userId: {
          notificationId: "notification-1",
          userId: "user-1",
        },
      },
      update: {},
      create: {
        notificationId: "notification-1",
        userId: "user-1",
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("대댓글 알림은 게시글 작성자와 부모 댓글 작성자에게 중복 없이 생성한다", async () => {
    const { prisma, service } = createService();
    prisma.userNotificationPreference.findMany.mockResolvedValue([]);

    await service.createCommunityCommentNotifications({
      actorUserId: "actor-1",
      postId: "post-1",
      postTitle: "알림 테스트",
      postAuthorUserId: "post-author",
      parentCommentAuthorUserId: "parent-author",
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(prisma.notification.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        userId: "post-author",
        notificationType: "community_comment",
        targetType: "community_post",
        targetId: "post-1",
      }),
    });
    expect(prisma.notification.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        userId: "parent-author",
        title: "새 답글이 달렸습니다",
        notificationType: "community_comment",
      }),
    });
  });

  it("좋아요 알림은 자기 자신에게 생성하지 않는다", async () => {
    const { prisma, service } = createService();

    await service.createCommunityLikeNotification({
      actorUserId: "user-1",
      postId: "post-1",
      postTitle: "같은 사용자 글",
      targetUserId: "user-1",
      targetKind: "post",
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("알림이 없으면 404로 읽음 처리를 막는다", async () => {
    const { prisma, service } = createService();
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead("user-1", "missing")).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });
});
