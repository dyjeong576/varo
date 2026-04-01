-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "current_stage" TEXT NOT NULL,
    "searched_source_count" INTEGER NOT NULL DEFAULT 0,
    "processed_source_count" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" TEXT,
    "query_refinement" JSONB,
    "handoff_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "review_job_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "publisher_name" TEXT,
    "published_at" TIMESTAMP(3),
    "canonical_url" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "raw_title" TEXT NOT NULL,
    "raw_snippet" TEXT,
    "normalized_hash" TEXT NOT NULL,
    "fetch_status" TEXT NOT NULL,
    "content_text" TEXT,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_group_key" TEXT,
    "origin_query_ids" JSONB,
    "relevance_tier" TEXT,
    "relevance_reason" TEXT,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_snippets" (
    "id" TEXT NOT NULL,
    "review_job_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "snippet_text" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "start_offset" INTEGER,
    "end_offset" INTEGER,

    CONSTRAINT "evidence_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_jobs_user_id_idx" ON "review_jobs"("user_id");

-- CreateIndex
CREATE INDEX "review_jobs_claim_id_idx" ON "review_jobs"("claim_id");

-- CreateIndex
CREATE INDEX "sources_review_job_id_idx" ON "sources"("review_job_id");

-- CreateIndex
CREATE INDEX "evidence_snippets_review_job_id_idx" ON "evidence_snippets"("review_job_id");

-- CreateIndex
CREATE INDEX "evidence_snippets_source_id_idx" ON "evidence_snippets"("source_id");

-- AddForeignKey
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_review_job_id_fkey" FOREIGN KEY ("review_job_id") REFERENCES "review_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_snippets" ADD CONSTRAINT "evidence_snippets_review_job_id_fkey" FOREIGN KEY ("review_job_id") REFERENCES "review_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_snippets" ADD CONSTRAINT "evidence_snippets_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
