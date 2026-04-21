import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/config/metadata";
import { NotificationPreferencesPanel } from "./_components/notification-preferences-panel";
import { SettingsPageShell } from "../_components/settings-page-shell";

export const metadata: Metadata = buildPageMetadata(
  "알림 설정",
  "review 완료와 커뮤니티 활동 알림의 수신 범위를 관리합니다.",
);

export default function SettingsNotificationsPage() {
  return (
    <SettingsPageShell
      title="알림 설정"
      description="꼭 필요한 알림만 받을 수 있게 설정할 수 있어요."
    >
      <NotificationPreferencesPanel />
    </SettingsPageShell>
  );
}
