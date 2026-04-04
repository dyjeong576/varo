CREATE TABLE "user_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "review_job_id" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_history_user_id_created_at_idx" ON "user_history"("user_id", "created_at");
CREATE INDEX "user_history_review_job_id_created_at_idx" ON "user_history"("review_job_id", "created_at");
CREATE INDEX "user_history_entry_type_created_at_idx" ON "user_history"("entry_type", "created_at");

ALTER TABLE "user_history"
ADD CONSTRAINT "user_history_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_history"
ADD CONSTRAINT "user_history_review_job_id_fkey"
FOREIGN KEY ("review_job_id") REFERENCES "review_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
