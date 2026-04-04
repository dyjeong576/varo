ALTER TABLE "community_comments"
ADD COLUMN "parent_comment_id" TEXT;

CREATE INDEX "community_comments_parent_comment_id_idx"
ON "community_comments"("parent_comment_id");

ALTER TABLE "community_comments"
ADD CONSTRAINT "community_comments_parent_comment_id_fkey"
FOREIGN KEY ("parent_comment_id") REFERENCES "community_comments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_comment_likes" (
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_comment_likes_pkey" PRIMARY KEY ("comment_id","user_id")
);

CREATE INDEX "community_comment_likes_user_id_idx"
ON "community_comment_likes"("user_id");

ALTER TABLE "community_comment_likes"
ADD CONSTRAINT "community_comment_likes_comment_id_fkey"
FOREIGN KEY ("comment_id") REFERENCES "community_comments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_comment_likes"
ADD CONSTRAINT "community_comment_likes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
