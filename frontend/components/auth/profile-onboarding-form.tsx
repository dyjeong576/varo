"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import {
  KOREA_COUNTRY_NAME,
  KOREA_MAJOR_CITIES,
} from "@/lib/profile/location-options";

const GENDER_OPTIONS = ["남성", "여성", "기타", "응답 안 함"] as const;
const AGE_OPTIONS = ["10대", "20대", "30대", "40대", "50대", "60대 이상"] as const;

export function ProfileOnboardingForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    realName: "",
    gender: GENDER_OPTIONS[0],
    ageRange: AGE_OPTIONS[2],
    country: KOREA_COUNTRY_NAME,
    city: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await api.users.updateMyProfile(formData);
      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "프로필 저장에 실패했습니다.");
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
          실명
          <input
            value={formData.realName}
            onChange={(event) => handleChange("realName", event.target.value)}
            className="h-12 rounded-2xl border border-gray-200 px-4 text-[15px] font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="이름을 입력하세요"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
          성별
          <select
            value={formData.gender}
            onChange={(event) => handleChange("gender", event.target.value)}
            className="h-12 rounded-2xl border border-gray-200 px-4 text-[15px] font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
          나이대
          <select
            value={formData.ageRange}
            onChange={(event) => handleChange("ageRange", event.target.value)}
            className="h-12 rounded-2xl border border-gray-200 px-4 text-[15px] font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {AGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
          활동 국가
          <input
            value={formData.country}
            disabled
            readOnly
            className="h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[15px] font-medium text-gray-500"
            required
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
        활동 도시
        <select
          value={formData.city}
          onChange={(event) => handleChange("city", event.target.value)}
          className="h-12 rounded-2xl border border-gray-200 px-4 text-[15px] font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          required
        >
          <option value="" disabled>
            활동 도시를 선택하세요
          </option>
          {KOREA_MAJOR_CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSaving || !formData.city}
        className="mt-2 flex h-14 items-center justify-center rounded-2xl bg-[#0050cb] text-base font-bold text-white shadow-lg shadow-[#0050cb]/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
      >
        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "프로필 저장하고 시작하기"}
      </button>
    </form>
  );
}
