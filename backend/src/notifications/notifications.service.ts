import { HttpStatus, Injectable } from "@nestjs/common";
import type { Notification, UserNotificationPreference } from "@prisma/client";
import { APP_ERROR_CODES } from "../common/constants/app-error-codes";
import { AppException } from "../common/exceptions/app-exception";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationActionResponseDto } from "./dto/notification-action-response.dto";
import { NotificationItemResponseDto } from "./dto/notification-item-response.dto";
import { NotificationListResponseDto } from "./dto/notification-list-response.dto";
import { NotificationPreferencesResponseDto } from "./dto/notification-preferences-response.dto";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";

const NOTIFICATION_PAGE_SIZE = 50;

type NotificationPreferenceKey =
  | "reviewCompleted"
  | "communityComment"
  | "communityLike";

type CommunityCommentNotificationParams = {
  actorUserId: string;
  postId: string;
  postTitle: string;
  postAuthorUserId: string;
  parentCommentAuthorUserId: string | null;
};

type CommunityLikeNotificationParams =
  | {
      actorUserId: string;
      postId: string;
      postTitle: string;
      targetUserId: string;
      targetKind: "post";
    }
  | {
      actorUserId: string;
      postId: string;
      postTitle: string;
      targetUserId: string;
      targetKind: "comment";
    };

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listNotifications(userId: string): Promise<NotificationListResponseDto> {
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: NOTIFICATION_PAGE_SIZE,
        include: {
          reads: {
            where: { userId },
            select: {
              userId: true,
            },
          },
        },
      }),
      this.prisma.notification.count({
        where: {
          userId,
          reads: {
            none: {
              userId,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((item) => this.toNotificationItem(item)),
      unreadCount,
    };
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationActionResponseDto> {
    await this.ensureNotificationOwner(userId, notificationId);

    await this.prisma.notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId,
          userId,
        },
      },
      update: {},
      create: {
        notificationId,
        userId,
      },
    });

    return { ok: true };
  }

  async markAllRead(userId: string): Promise<NotificationActionResponseDto> {
    const unreadNotifications = await this.prisma.notification.findMany({
      where: {
        userId,
        reads: {
          none: {
            userId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (unreadNotifications.length > 0) {
      await this.prisma.notificationRead.createMany({
        data: unreadNotifications.map((item) => ({
          notificationId: item.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    return { ok: true };
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<NotificationActionResponseDto> {
    await this.ensureNotificationOwner(userId, notificationId);

    await this.prisma.notification.delete({
      where: {
        id: notificationId,
      },
    });

    return { ok: true };
  }

  async deleteAll(userId: string): Promise<NotificationActionResponseDto> {
    await this.prisma.notification.deleteMany({
      where: {
        userId,
      },
    });

    return { ok: true };
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesResponseDto> {
    const preferences = await this.prisma.userNotificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    return this.toPreferenceResponse(preferences);
  }

  async updatePreferences(
    userId: string,
    payload: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponseDto> {
    const preferences = await this.prisma.userNotificationPreference.upsert({
      where: { userId },
      update: {
        reviewCompleted: payload.reviewCompleted ?? undefined,
        communityComment: payload.communityComment ?? undefined,
        communityLike: payload.communityLike ?? undefined,
      },
      create: {
        userId,
        reviewCompleted: payload.reviewCompleted ?? true,
        communityComment: payload.communityComment ?? true,
        communityLike: payload.communityLike ?? true,
      },
    });

    return this.toPreferenceResponse(preferences);
  }

  async createReviewCompletedNotification(params: {
    userId: string;
    reviewId: string;
    claim: string;
  }): Promise<void> {
    const enabled = await this.isPreferenceEnabled(params.userId, "reviewCompleted");

    if (!enabled) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        notificationType: "review_completed",
        title: "근거 수집 완료",
        body: `"${params.claim}" 검토가 완료되었습니다.`,
        targetType: "review",
        targetId: params.reviewId,
      },
    });
  }

  async createCommunityCommentNotifications(
    params: CommunityCommentNotificationParams,
  ): Promise<void> {
    const recipientIds = new Set<string>();

    if (params.postAuthorUserId !== params.actorUserId) {
      recipientIds.add(params.postAuthorUserId);
    }

    if (
      params.parentCommentAuthorUserId &&
      params.parentCommentAuthorUserId !== params.actorUserId
    ) {
      recipientIds.add(params.parentCommentAuthorUserId);
    }

    const enabledRecipients = await this.filterRecipientsByPreference(
      Array.from(recipientIds),
      "communityComment",
    );

    await Promise.all(
      enabledRecipients.map((recipientId) =>
        this.prisma.notification.create({
          data: {
            userId: recipientId,
            notificationType: "community_comment",
            title:
              recipientId === params.parentCommentAuthorUserId
                ? "새 답글이 달렸습니다"
                : "새 댓글이 달렸습니다",
            body:
              recipientId === params.parentCommentAuthorUserId
                ? `"${params.postTitle}" 글에서 내 댓글에 새 답글이 등록되었습니다.`
                : `"${params.postTitle}" 글에 새로운 댓글이 등록되었습니다.`,
            targetType: "community_post",
            targetId: params.postId,
          },
        }),
      ),
    );
  }

  async createCommunityLikeNotification(
    params: CommunityLikeNotificationParams,
  ): Promise<void> {
    if (params.targetUserId === params.actorUserId) {
      return;
    }

    const enabled = await this.isPreferenceEnabled(params.targetUserId, "communityLike");

    if (!enabled) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: params.targetUserId,
        notificationType: "community_like",
        title:
          params.targetKind === "comment"
            ? "내 댓글에 공감이 추가되었습니다"
            : "새 공감이 추가되었습니다",
        body:
          params.targetKind === "comment"
            ? `"${params.postTitle}" 글의 내 댓글에 공감이 추가되었습니다.`
            : `"${params.postTitle}" 글에 공감이 추가되었습니다.`,
        targetType: "community_post",
        targetId: params.postId,
      },
    });
  }

  private async ensureNotificationOwner(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!notification) {
      throw new AppException(
        APP_ERROR_CODES.NOT_FOUND,
        "알림을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async filterRecipientsByPreference(
    userIds: string[],
    preferenceKey: NotificationPreferenceKey,
  ): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }

    const preferences = await this.prisma.userNotificationPreference.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });

    const preferenceMap = new Map(
      preferences.map((preference) => [preference.userId, preference]),
    );

    return userIds.filter((userId) => {
      const preference = preferenceMap.get(userId);

      if (!preference) {
        return true;
      }

      return preference[preferenceKey];
    });
  }

  private async isPreferenceEnabled(
    userId: string,
    preferenceKey: NotificationPreferenceKey,
  ): Promise<boolean> {
    const preference = await this.prisma.userNotificationPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return true;
    }

    return preference[preferenceKey];
  }

  private toNotificationItem(
    notification: Notification & { reads: Array<{ userId: string }> },
  ): NotificationItemResponseDto {
    return {
      id: notification.id,
      type: notification.notificationType as NotificationItemResponseDto["type"],
      title: notification.title,
      message: notification.body,
      isRead: notification.reads.length > 0,
      createdAt: notification.createdAt.toISOString(),
      targetType: notification.targetType as NotificationItemResponseDto["targetType"],
      targetId: notification.targetId,
    };
  }

  private toPreferenceResponse(
    preference: UserNotificationPreference,
  ): NotificationPreferencesResponseDto {
    return {
      reviewCompleted: preference.reviewCompleted,
      communityComment: preference.communityComment,
      communityLike: preference.communityLike,
    };
  }
}
