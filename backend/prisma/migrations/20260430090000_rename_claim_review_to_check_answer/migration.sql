ALTER TABLE "claims" RENAME TO "checks";
ALTER TABLE "review_jobs" RENAME TO "answer_jobs";

ALTER TABLE "answer_jobs" RENAME COLUMN "claim_id" TO "check_id";
ALTER TABLE "user_history" RENAME COLUMN "review_job_id" TO "answer_job_id";
ALTER TABLE "sources" RENAME COLUMN "review_job_id" TO "answer_job_id";
ALTER TABLE "evidence_snippets" RENAME COLUMN "review_job_id" TO "answer_job_id";
ALTER TABLE "user_notification_preferences" RENAME COLUMN "review_completed" TO "answer_completed";

ALTER INDEX IF EXISTS "review_jobs_user_id_idx" RENAME TO "answer_jobs_user_id_idx";
ALTER INDEX IF EXISTS "review_jobs_claim_id_idx" RENAME TO "answer_jobs_check_id_idx";
ALTER INDEX IF EXISTS "review_jobs_user_id_client_request_id_key" RENAME TO "answer_jobs_user_id_client_request_id_key";
ALTER INDEX IF EXISTS "sources_review_job_id_idx" RENAME TO "sources_answer_job_id_idx";
ALTER INDEX IF EXISTS "evidence_snippets_review_job_id_idx" RENAME TO "evidence_snippets_answer_job_id_idx";
ALTER INDEX IF EXISTS "user_history_review_job_id_created_at_idx" RENAME TO "user_history_answer_job_id_created_at_idx";

ALTER TABLE "checks" RENAME CONSTRAINT "claims_pkey" TO "checks_pkey";
ALTER TABLE "answer_jobs" RENAME CONSTRAINT "review_jobs_pkey" TO "answer_jobs_pkey";
ALTER TABLE "answer_jobs" RENAME CONSTRAINT "review_jobs_user_id_fkey" TO "answer_jobs_user_id_fkey";
ALTER TABLE "answer_jobs" RENAME CONSTRAINT "review_jobs_claim_id_fkey" TO "answer_jobs_check_id_fkey";
ALTER TABLE "sources" RENAME CONSTRAINT "sources_review_job_id_fkey" TO "sources_answer_job_id_fkey";
ALTER TABLE "evidence_snippets" RENAME CONSTRAINT "evidence_snippets_review_job_id_fkey" TO "evidence_snippets_answer_job_id_fkey";
ALTER TABLE "user_history" RENAME CONSTRAINT "user_history_review_job_id_fkey" TO "user_history_answer_job_id_fkey";

UPDATE "answer_jobs"
SET "query_refinement" = replace(
  replace(
    replace(
      replace("query_refinement"::text, '"coreClaim"', '"coreCheck"'),
      '"normalizedClaim"',
      '"normalizedCheck"'
    ),
    '"claimType"',
    '"checkType"'
  ),
  'claim_specific',
  'check_specific'
)::jsonb
WHERE "query_refinement" IS NOT NULL;

UPDATE "answer_jobs"
SET "handoff_payload" = replace(
  replace(
    replace(
      replace("handoff_payload"::text, '"coreClaim"', '"coreCheck"'),
      '"stanceToClaim"',
      '"stanceToCheck"'
    ),
    '"currentReviewImpact"',
    '"currentAnswerImpact"'
  ),
  'claim_specific',
  'check_specific'
)::jsonb
WHERE "handoff_payload" IS NOT NULL;

UPDATE "notifications"
SET "target_type" = 'answer'
WHERE "target_type" = 'review';

UPDATE "notifications"
SET "notification_type" = 'answer_completed'
WHERE "notification_type" = 'review_completed';
