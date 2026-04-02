ALTER TABLE "review_jobs"
ADD COLUMN "client_request_id" TEXT;

CREATE UNIQUE INDEX "review_jobs_user_id_client_request_id_key"
ON "review_jobs"("user_id", "client_request_id");
