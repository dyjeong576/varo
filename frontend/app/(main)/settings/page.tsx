export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-full bg-[#f8fafc] px-5 pt-6 pb-12 font-sans">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-8 mx-1">설정</h1>
      
      {/* List will be client-rendered for now */}
      <SettingsNav />
    </div>
  );
}

// Inline component initially
import { SettingsNav } from "./_components/settings-nav";
