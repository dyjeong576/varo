-- AlterTable
ALTER TABLE "sources"
ADD COLUMN "source_country_code" TEXT,
ADD COLUMN "retrieval_bucket" TEXT,
ADD COLUMN "domain_registry_id" TEXT;

-- CreateTable
CREATE TABLE "source_domain_registry" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "language_code" TEXT,
    "source_kind" TEXT NOT NULL,
    "usage_role" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_domain_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_domain_registry_domain_usage_role_key"
ON "source_domain_registry"("domain", "usage_role");

-- CreateIndex
CREATE INDEX "source_domain_registry_country_code_usage_role_is_active_idx"
ON "source_domain_registry"("country_code", "usage_role", "is_active");

-- CreateIndex
CREATE INDEX "sources_domain_registry_id_idx" ON "sources"("domain_registry_id");

-- AddForeignKey
ALTER TABLE "sources"
ADD CONSTRAINT "sources_domain_registry_id_fkey"
FOREIGN KEY ("domain_registry_id") REFERENCES "source_domain_registry"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed curated registry
INSERT INTO "source_domain_registry" (
    "id", "domain", "country_code", "language_code", "source_kind", "usage_role", "priority", "is_active", "created_at", "updated_at"
) VALUES
    ('sdr-kr-001', 'yna.co.kr', 'KR', 'ko', 'news_agency', 'familiar_news', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-002', 'newsis.com', 'KR', 'ko', 'news_agency', 'familiar_news', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-003', 'kbs.co.kr', 'KR', 'ko', 'broadcaster', 'familiar_news', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-007', 'imbc.com', 'KR', 'ko', 'broadcaster', 'familiar_news', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-008', 'sbs.co.kr', 'KR', 'ko', 'broadcaster', 'familiar_news', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-009', 'ytn.co.kr', 'KR', 'ko', 'broadcaster', 'familiar_news', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-010', 'jtbc.co.kr', 'KR', 'ko', 'broadcaster', 'familiar_news', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-011', 'joongang.co.kr', 'KR', 'ko', 'newspaper', 'familiar_news', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-012', 'donga.com', 'KR', 'ko', 'newspaper', 'familiar_news', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-013', 'hani.co.kr', 'KR', 'ko', 'newspaper', 'familiar_news', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-014', 'khan.co.kr', 'KR', 'ko', 'newspaper', 'familiar_news', 110, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-015', 'mk.co.kr', 'KR', 'ko', 'business_newspaper', 'familiar_news', 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-016', 'hankyung.com', 'KR', 'ko', 'business_newspaper', 'familiar_news', 130, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-017', 'sedaily.com', 'KR', 'ko', 'business_newspaper', 'familiar_news', 140, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-018', 'edaily.co.kr', 'KR', 'ko', 'digital_news', 'familiar_news', 150, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-019', 'mt.co.kr', 'KR', 'ko', 'digital_news', 'familiar_news', 160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-020', 'nocutnews.co.kr', 'KR', 'ko', 'digital_news', 'familiar_news', 170, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-021', 'ohmynews.com', 'KR', 'ko', 'digital_news', 'familiar_news', 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-022', 'segye.com', 'KR', 'ko', 'newspaper', 'familiar_news', 190, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-023', 'hankookilbo.com', 'KR', 'ko', 'newspaper', 'familiar_news', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-024', 'munhwa.com', 'KR', 'ko', 'newspaper', 'familiar_news', 210, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-025', 'yonhapnewstv.co.kr', 'KR', 'ko', 'broadcaster', 'familiar_news', 220, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-026', 'kmib.co.kr', 'KR', 'ko', 'newspaper', 'familiar_news', 230, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-027', 'kukinews.com', 'KR', 'ko', 'digital_news', 'familiar_news', 240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-004', 'korea.kr', 'KR', 'ko', 'government', 'verification_official', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-005', '*.go.kr', 'KR', 'ko', 'government', 'verification_official', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-006', 'yna.co.kr', 'KR', 'ko', 'news_agency', 'verification_news', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-028', 'newsis.com', 'KR', 'ko', 'news_agency', 'verification_news', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-029', 'kbs.co.kr', 'KR', 'ko', 'broadcaster', 'verification_news', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-030', 'ytn.co.kr', 'KR', 'ko', 'broadcaster', 'verification_news', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-031', 'jtbc.co.kr', 'KR', 'ko', 'broadcaster', 'verification_news', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-kr-032', 'sbs.co.kr', 'KR', 'ko', 'broadcaster', 'verification_news', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-us-001', 'apnews.com', 'US', 'en', 'news_agency', 'verification_news', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-us-002', 'reuters.com', 'US', 'en', 'news_agency', 'verification_news', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-us-003', '*.gov', 'US', 'en', 'government', 'verification_official', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-jp-001', 'nhk.or.jp', 'JP', 'ja', 'broadcaster', 'verification_news', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-jp-002', 'kyodonews.jp', 'JP', 'ja', 'news_agency', 'verification_news', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-jp-003', '*.go.jp', 'JP', 'ja', 'government', 'verification_official', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-global-001', 'reuters.com', 'GLOBAL', 'en', 'news_agency', 'global_reference', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-global-002', 'apnews.com', 'GLOBAL', 'en', 'news_agency', 'global_reference', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sdr-global-003', 'bbc.com', 'GLOBAL', 'en', 'broadcaster', 'global_reference', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
