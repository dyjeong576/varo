DO $$
BEGIN
  IF to_regclass('public.answer_jobs') IS NULL
    AND to_regclass('public.checks') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'checks'
        AND column_name = 'raw_question'
    )
  THEN
    ALTER TABLE "checks" RENAME TO "answer_jobs";

    CREATE TABLE "checks" (
      "id" TEXT NOT NULL,
      "raw_text" TEXT NOT NULL,
      "normalized_text" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "checks_pkey" PRIMARY KEY ("id")
    );

    INSERT INTO "checks" ("id", "raw_text", "normalized_text", "created_at")
    SELECT
      "id",
      COALESCE("raw_question", ''),
      COALESCE("normalized_question", "raw_question", ''),
      "created_at"
    FROM "answer_jobs";

    ALTER TABLE "answer_jobs" ADD COLUMN "check_id" TEXT;
    UPDATE "answer_jobs" SET "check_id" = "id" WHERE "check_id" IS NULL;
    ALTER TABLE "answer_jobs" ALTER COLUMN "check_id" SET NOT NULL;
    ALTER TABLE "answer_jobs" DROP COLUMN "raw_question";
    ALTER TABLE "answer_jobs" DROP COLUMN "normalized_question";
  END IF;
END $$;

ALTER TABLE IF EXISTS "claims" RENAME TO "checks";
ALTER TABLE IF EXISTS "review_jobs" RENAME TO "answer_jobs";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'answer_jobs'
      AND column_name = 'claim_id'
  ) THEN
    ALTER TABLE "answer_jobs" RENAME COLUMN "claim_id" TO "check_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_history'
      AND column_name = 'review_job_id'
  ) THEN
    ALTER TABLE "user_history" RENAME COLUMN "review_job_id" TO "answer_job_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_history'
      AND column_name = 'check_id'
  ) THEN
    ALTER TABLE "user_history" RENAME COLUMN "check_id" TO "answer_job_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sources'
      AND column_name = 'review_job_id'
  ) THEN
    ALTER TABLE "sources" RENAME COLUMN "review_job_id" TO "answer_job_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sources'
      AND column_name = 'check_id'
  ) THEN
    ALTER TABLE "sources" RENAME COLUMN "check_id" TO "answer_job_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence_snippets'
      AND column_name = 'review_job_id'
  ) THEN
    ALTER TABLE "evidence_snippets" RENAME COLUMN "review_job_id" TO "answer_job_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence_snippets'
      AND column_name = 'check_id'
  ) THEN
    ALTER TABLE "evidence_snippets" RENAME COLUMN "check_id" TO "answer_job_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notification_preferences'
      AND column_name = 'review_completed'
  ) THEN
    ALTER TABLE "user_notification_preferences" RENAME COLUMN "review_completed" TO "answer_completed";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notification_preferences'
      AND column_name = 'check_completed'
  ) THEN
    ALTER TABLE "user_notification_preferences" RENAME COLUMN "check_completed" TO "answer_completed";
  END IF;
END $$;

ALTER INDEX IF EXISTS "review_jobs_user_id_idx" RENAME TO "answer_jobs_user_id_idx";
ALTER INDEX IF EXISTS "review_jobs_claim_id_idx" RENAME TO "answer_jobs_check_id_idx";
ALTER INDEX IF EXISTS "review_jobs_user_id_client_request_id_key" RENAME TO "answer_jobs_user_id_client_request_id_key";
ALTER INDEX IF EXISTS "checks_user_id_idx" RENAME TO "answer_jobs_user_id_idx";
ALTER INDEX IF EXISTS "checks_user_id_client_request_id_key" RENAME TO "answer_jobs_user_id_client_request_id_key";
ALTER INDEX IF EXISTS "sources_review_job_id_idx" RENAME TO "sources_answer_job_id_idx";
ALTER INDEX IF EXISTS "sources_check_id_idx" RENAME TO "sources_answer_job_id_idx";
ALTER INDEX IF EXISTS "evidence_snippets_review_job_id_idx" RENAME TO "evidence_snippets_answer_job_id_idx";
ALTER INDEX IF EXISTS "evidence_snippets_check_id_idx" RENAME TO "evidence_snippets_answer_job_id_idx";
ALTER INDEX IF EXISTS "user_history_review_job_id_created_at_idx" RENAME TO "user_history_answer_job_id_created_at_idx";
ALTER INDEX IF EXISTS "user_history_check_id_created_at_idx" RENAME TO "user_history_answer_job_id_created_at_idx";

DO $$
BEGIN
  IF to_regclass('public.answer_jobs') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.answer_jobs'::regclass
        AND conname = 'review_jobs_pkey'
    ) THEN
      ALTER TABLE "answer_jobs" RENAME CONSTRAINT "review_jobs_pkey" TO "answer_jobs_pkey";
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.answer_jobs'::regclass
        AND conname = 'checks_pkey'
    ) THEN
      ALTER TABLE "answer_jobs" RENAME CONSTRAINT "checks_pkey" TO "answer_jobs_pkey";
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'answer_jobs_pkey'
    ) THEN
      ALTER TABLE "answer_jobs" ADD CONSTRAINT "answer_jobs_pkey" PRIMARY KEY ("id");
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.answer_jobs') IS NOT NULL THEN
    ALTER TABLE "answer_jobs" DROP CONSTRAINT IF EXISTS "review_jobs_user_id_fkey";
    ALTER TABLE "answer_jobs" DROP CONSTRAINT IF EXISTS "checks_user_id_fkey";
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'answer_jobs_user_id_fkey'
    ) THEN
      ALTER TABLE "answer_jobs"
      ADD CONSTRAINT "answer_jobs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    ALTER TABLE "answer_jobs" DROP CONSTRAINT IF EXISTS "review_jobs_claim_id_fkey";
    ALTER TABLE "answer_jobs" DROP CONSTRAINT IF EXISTS "checks_check_id_fkey";
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'answer_jobs_check_id_fkey'
    ) THEN
      ALTER TABLE "answer_jobs"
      ADD CONSTRAINT "answer_jobs_check_id_fkey"
      FOREIGN KEY ("check_id") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sources') IS NOT NULL THEN
    ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_review_job_id_fkey";
    ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_check_id_fkey";
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'sources_answer_job_id_fkey'
    ) THEN
      ALTER TABLE "sources"
      ADD CONSTRAINT "sources_answer_job_id_fkey"
      FOREIGN KEY ("answer_job_id") REFERENCES "answer_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.evidence_snippets') IS NOT NULL THEN
    ALTER TABLE "evidence_snippets" DROP CONSTRAINT IF EXISTS "evidence_snippets_review_job_id_fkey";
    ALTER TABLE "evidence_snippets" DROP CONSTRAINT IF EXISTS "evidence_snippets_check_id_fkey";
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'evidence_snippets_answer_job_id_fkey'
    ) THEN
      ALTER TABLE "evidence_snippets"
      ADD CONSTRAINT "evidence_snippets_answer_job_id_fkey"
      FOREIGN KEY ("answer_job_id") REFERENCES "answer_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.user_history') IS NOT NULL THEN
    ALTER TABLE "user_history" DROP CONSTRAINT IF EXISTS "user_history_review_job_id_fkey";
    ALTER TABLE "user_history" DROP CONSTRAINT IF EXISTS "user_history_check_id_fkey";
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'user_history_answer_job_id_fkey'
    ) THEN
      ALTER TABLE "user_history"
      ADD CONSTRAINT "user_history_answer_job_id_fkey"
      FOREIGN KEY ("answer_job_id") REFERENCES "answer_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

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
WHERE to_regclass('public.answer_jobs') IS NOT NULL
  AND "query_refinement" IS NOT NULL;

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
WHERE to_regclass('public.answer_jobs') IS NOT NULL
  AND "handoff_payload" IS NOT NULL;

UPDATE "notifications"
SET "target_type" = 'answer'
WHERE to_regclass('public.notifications') IS NOT NULL
  AND "target_type" IN ('review', 'check');

UPDATE "notifications"
SET "notification_type" = 'answer_completed'
WHERE to_regclass('public.notifications') IS NOT NULL
  AND "notification_type" IN ('review_completed', 'check_completed');
