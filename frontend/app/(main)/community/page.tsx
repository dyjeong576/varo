import TrustBanner from "./_components/trust-banner";
import WritePostButton from "./_components/write-post-button";
import { PostList } from "./_components/post-list";

export default function CommunityPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <TrustBanner />
        <WritePostButton />
      </div>
      <div className="mt-4 space-y-4">
        <PostList />
      </div>
    </div>
  );
}
