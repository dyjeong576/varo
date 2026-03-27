import TrustBanner from "./_components/trust-banner";
import WritePostButton from "./_components/write-post-button";
import { PostList } from "./_components/post-list";

export default function CommunityPage() {
  return (
    <div className="pb-20 max-w-2xl mx-auto pt-6 space-y-6 px-4 md:px-0">
      <TrustBanner />
      <WritePostButton />
      <div className="space-y-4">
        <PostList />
      </div>
    </div>
  );
}
