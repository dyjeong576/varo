"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { UserProfile, mockUserProfile } from "@/lib/mock-data";
import { Loader2, Camera, ShieldAlert } from "lucide-react";

export function ProfileForm() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ country: '', city: '' });

  useEffect(() => {
    // API mock load
    const timer = setTimeout(() => {
      setProfile(mockUserProfile);
      setFormData({
        country: mockUserProfile.country,
        city: mockUserProfile.city,
      });
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Submit mock
    setTimeout(() => {
      setIsSaving(false);
      // Optional: show a toast or notification success message
      alert('성공적으로 저장되었습니다.');
    }, 800);
  };

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 text-verifi-blue animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col">
      {/* Avatar Section */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative mb-4 group cursor-pointer">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-sm">
            <Image 
              src={profile.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} 
              alt="프로필 이미지" 
              width={96} 
              height={96} 
              unoptimized
              className="object-cover bg-blue-50"
            />
          </div>
          <div className="absolute right-0 bottom-0 bg-white p-2 border border-gray-100 rounded-full shadow-md text-gray-500 group-hover:text-verifi-blue transition-colors">
            <Camera className="w-4 h-4" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
        <p className="text-sm font-medium text-gray-500">{profile.email}</p>
      </div>

      <div className="p-4 mb-6 bg-[#f8fbff] rounded-2xl border border-blue-100 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-verifi-blue shrink-0 mt-0.5" />
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
                value={profile.name} 
                disabled 
                className="w-full h-12 px-4 rounded-xl bg-gray-50 border-transparent text-gray-500 text-[14px] font-medium"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-gray-500">성별 · 연령대</label>
              <input 
                type="text" 
                value={`${profile.gender} · ${profile.ageGroup}`} 
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
            <select 
              value={formData.country}
              onChange={(e) => setFormData({...formData, country: e.target.value})}
              className="w-full h-12 px-4 rounded-xl bg-white border border-gray-200 text-gray-900 text-[14px] font-medium focus:ring-2 focus:ring-verifi-blue/20 focus:border-verifi-blue outline-none transition-all appearance-none"
            >
              <option value="대한민국">대한민국</option>
              <option value="일본">일본</option>
              <option value="미국">미국</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-500">도시</label>
            <input 
              type="text" 
              value={formData.city} 
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              className="w-full h-12 px-4 rounded-xl bg-white border border-gray-200 text-gray-900 text-[14px] font-medium focus:ring-2 focus:ring-verifi-blue/20 focus:border-verifi-blue outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isSaving || (formData.country === profile.country && formData.city === profile.city)}
        className="w-full mt-auto mb-4 h-14 rounded-2xl bg-gray-900 text-white font-bold text-[15px] flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '저장하기'}
      </button>
    </form>
  );
}
