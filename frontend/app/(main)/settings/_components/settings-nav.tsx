"use client";

import Link from "next/link";
import { User, BellRing, Lock, HelpCircle, LogOut, ChevronRight } from "lucide-react";

export function SettingsNav() {
  const sections = [
    {
      title: "계정",
      items: [
        { icon: <User className="w-5 h-5" />, label: "내 정보 관리", href: "/user-info" },
        { icon: <Lock className="w-5 h-5" />, label: "개인정보 보호", href: "#" },
      ]
    },
    {
      title: "앱 설정",
      items: [
        { icon: <BellRing className="w-5 h-5" />, label: "알림 설정", href: "#" },
        { icon: <HelpCircle className="w-5 h-5" />, label: "고객 센터", href: "#" },
      ]
    }
  ];

  return (
    <div className="flex flex-col space-y-8">
      {sections.map((section, idx) => (
        <div key={idx} className="flex flex-col">
          <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{section.title}</h3>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {section.items.map((item, itemIdx) => (
              <Link 
                key={itemIdx} 
                href={item.href}
                className={`flex items-center justify-between p-4 px-5 active:bg-gray-50 transition-colors ${
                  itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-50 rounded-xl text-gray-600">
                    {item.icon}
                  </div>
                  <span className="text-[15px] font-semibold text-gray-800">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-4 px-1">
        <button className="flex items-center gap-3 w-full p-4 rounded-2xl text-red-500 font-semibold hover:bg-red-50 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="text-[15px]">로그아웃</span>
        </button>
      </div>
    </div>
  );
}
