import { ProfileForm } from "./_components/profile-form";

export default function UserInfoPage() {
  return (
    <div className="flex flex-col min-h-full bg-white font-sans">
      {/* Header handled by app shell typically */}
      <div className="px-5 pt-6 pb-12">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-8">내 정보 관리</h1>
        
        {/* Form component */}
        <ProfileForm />
      </div>
    </div>
  );
}
