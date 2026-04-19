"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api/client";
import type { UserMeResponse } from "@/lib/api/types";
import {
  KOREA_COUNTRY_NAME,
  KOREA_MAJOR_CITIES,
  normalizeKoreaCity,
} from "@/lib/profile/location-options";

export function ProfileForm() {
  const [profile, setProfile] = useState<UserMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    country: KOREA_COUNTRY_NAME,
    city: "",
  });
  const [initialLocation, setInitialLocation] = useState({
    country: KOREA_COUNTRY_NAME,
    city: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const response = await api.users.getMe();

        if (!isMounted) {
          return;
        }

        setProfile(response);
        const nextLocation = {
          country: KOREA_COUNTRY_NAME,
          city: normalizeKoreaCity(response.profile.city),
        };

        setFormData(nextLocation);
        setInitialLocation({
          country:
            response.profile.country === KOREA_COUNTRY_NAME
              ? KOREA_COUNTRY_NAME
              : "",
          city: normalizeKoreaCity(response.profile.city),
        });
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "프로필을 불러오지 못했습니다.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const response = await api.users.updateMyProfile({
        country: KOREA_COUNTRY_NAME,
        city: formData.city,
      });
      setProfile(response);
      setInitialLocation({
        country: KOREA_COUNTRY_NAME,
        city: normalizeKoreaCity(response.profile.city),
      });
      setSuccessMessage("성공적으로 저장되었습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "프로필 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = profile.profile.realName ?? profile.user.displayName ?? "이름 미설정";
  const email = profile.user.email;

  return (
    <form onSubmit={handleSave} className="flex flex-col">
      <div className="flex flex-col items-center mb-10">
        <div className="mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-sm">
            <Image
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`}
              alt="프로필 이미지"
              width={96}
              height={96}
              unoptimized
              className="object-cover bg-blue-50"
            />
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-900">{displayName}</h2>
        <p className="text-sm font-medium text-gray-500">{email}</p>
      </div>

      <div className="p-4 mb-6 bg-[#f8fbff] rounded-2xl border border-blue-100 flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-[13px] text-blue-900/80 break-keep leading-relaxed font-medium">
          신뢰성 있는 커뮤니티 환경을 위해 이름, 성별, 연령대 등 본인인증을 통해 수집된 정보는 프로필에서 임의로 수정할 수 없습니다.
        </p>
      </div>

      <div className="space-y-6 mb-10">
        <div className="flex flex-col space-y-4 border-b border-gray-100 pb-6">
          <h3 className="text-[13.5px] font-bold text-gray-900">기본 정보 (수정 불가)</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-gray-500">이름</label>
              <input
                type="text"
                value={displayName}
                disabled
                className="w-full h-12 px-4 rounded-xl bg-gray-50 border-transparent text-gray-500 text-[14px] font-medium"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-gray-500">성별 · 연령대</label>
              <input
                type="text"
                value={`${profile.profile.gender ?? "-"} · ${profile.profile.ageRange ?? "-"}`}
                disabled
                className="w-full h-12 px-4 rounded-xl bg-gray-50 border-transparent text-gray-500 text-[14px] font-medium"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <h3 className="text-[13.5px] font-bold text-gray-900">활동 지역 (수정 가능)</h3>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-500">국가</label>
            <input
              value={formData.country}
              disabled
              readOnly
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-[14px] font-medium text-gray-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-500">도시</label>
            <select
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-medium text-gray-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
          </div>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mb-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
          {successMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          isSaving ||
          !formData.city ||
          (formData.country === initialLocation.country &&
            formData.city === initialLocation.city)
        }
        className="w-full mt-auto mb-4 h-14 rounded-2xl bg-gray-900 text-white font-bold text-[15px] flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "저장하기"}
      </button>
    </form>
  );
}
