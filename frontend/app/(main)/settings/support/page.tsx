import type { Metadata } from "next";
import { HelpCircle, MessageCircleQuestion, ShieldQuestion } from "lucide-react";
import { buildPageMetadata } from "@/lib/config/metadata";
import { SettingsPageShell } from "../_components/settings-page-shell";

export const metadata: Metadata = buildPageMetadata(
  "고객 센터",
  "VARO 사용 중 자주 묻는 질문과 현재 문의 안내를 확인할 수 있습니다.",
);

const faqItems = [
  {
    question: "review 결과는 사실을 확정해 주는 기능인가요?",
    answer:
      "아닙니다. VARO는 수집된 출처를 바탕으로 claim, evidence, interpretation, uncertainty를 구조화해 보여주는 서비스입니다. 결과는 절대적 진실 선언이 아니라 현재 확보된 근거 기준의 해석입니다.",
    icon: MessageCircleQuestion,
  },
  {
    question: "근거가 부족한데 왜 Unclear로 표시되나요?",
    answer:
      "출처가 충분하지 않거나 상충되는 경우에는 단정 대신 Unclear 또는 Mixed Evidence를 우선합니다. 기사 수만으로 결론을 내리지 않고, 어떤 근거가 부족한지도 함께 드러내는 것이 기본 원칙입니다.",
    icon: ShieldQuestion,
  },
  {
    question: "알림이 다른 기기와 동기화되지 않는 이유는 무엇인가요?",
    answer:
      "현재 알림 목록과 알림 설정은 서버 계정 기준으로 관리됩니다. 같은 계정으로 로그인하면 읽음 상태와 알림 설정이 함께 반영되며, 커뮤니티 알림은 게시글 상세 페이지로 연결됩니다.",
    icon: HelpCircle,
  },
  {
    question: "프로필에서 무엇을 수정할 수 있나요?",
    answer:
      "현재는 활동 지역인 국가와 도시만 수정할 수 있습니다. 실명, 성별, 연령대는 신뢰성 있는 커뮤니티 운영을 위해 읽기 전용으로 유지합니다.",
    icon: MessageCircleQuestion,
  },
];

export default function SettingsSupportPage() {
  return (
    <SettingsPageShell
      title="고객 센터"
      description="현재 제품 범위 기준의 자주 묻는 질문과 문의 안내를 확인할 수 있습니다."
    >
      <section className="rounded-3xl border border-[#d6e3fb] bg-[#f8fbff] p-5">
        <p className="text-sm font-semibold text-[#0f2f69]">문의 안내</p>
        <p className="mt-2 text-sm leading-relaxed text-[#355289]">
          1:1 문의 채널은 준비 중입니다. 운영 및 문의 응답 채널은 추후 공지를 통해 안내될
          예정이며, 현재 페이지에서는 제품 사용 범위와 기본 안내만 제공합니다.
        </p>
      </section>

      <section className="space-y-4">
        {faqItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.question}
              className="rounded-3xl border border-[#c2c6d8]/20 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-[#f2f3ff] p-3 text-[#0050cb]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold leading-6 text-[#191b24]">
                    {item.question}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#5b6170]">{item.answer}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </SettingsPageShell>
  );
}
