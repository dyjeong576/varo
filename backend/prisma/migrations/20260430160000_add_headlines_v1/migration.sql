CREATE TABLE "headline_scrape_runs" (
  "id" TEXT NOT NULL,
  "date_key" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "fetched_count" INTEGER NOT NULL DEFAULT 0,
  "saved_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "headline_scrape_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "headline_articles" (
  "id" TEXT NOT NULL,
  "date_key" TEXT NOT NULL,
  "publisher_key" TEXT NOT NULL,
  "publisher_name" TEXT NOT NULL,
  "feed_url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "summary" TEXT,
  "published_at" TIMESTAMP(3),
  "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "normalized_url" TEXT NOT NULL,
  "normalized_hash" TEXT NOT NULL,
  "raw_item" JSONB NOT NULL,
  CONSTRAINT "headline_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "headline_analyses" (
  "id" TEXT NOT NULL,
  "date_key" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "headline_analyses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "headline_event_clusters" (
  "id" TEXT NOT NULL,
  "analysis_id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "event_summary" TEXT NOT NULL,
  "common_facts" JSONB,
  "uncertainty" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "headline_event_clusters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "headline_event_cluster_items" (
  "id" TEXT NOT NULL,
  "cluster_id" TEXT NOT NULL,
  "article_id" TEXT,
  "publisher_key" TEXT NOT NULL,
  "publisher_name" TEXT NOT NULL,
  "article_title" TEXT NOT NULL,
  "article_url" TEXT NOT NULL,
  "expression_summary" TEXT NOT NULL,
  "emphasis" TEXT,
  "framing" TEXT,
  CONSTRAINT "headline_event_cluster_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "headline_scrape_runs_date_key_started_at_idx" ON "headline_scrape_runs"("date_key", "started_at");
CREATE INDEX "headline_articles_date_key_publisher_key_idx" ON "headline_articles"("date_key", "publisher_key");
CREATE INDEX "headline_articles_date_key_published_at_idx" ON "headline_articles"("date_key", "published_at");
CREATE UNIQUE INDEX "headline_articles_publisher_key_normalized_url_key" ON "headline_articles"("publisher_key", "normalized_url");
CREATE UNIQUE INDEX "headline_analyses_date_key_key" ON "headline_analyses"("date_key");
CREATE INDEX "headline_event_clusters_analysis_id_sort_order_idx" ON "headline_event_clusters"("analysis_id", "sort_order");
CREATE INDEX "headline_event_cluster_items_cluster_id_idx" ON "headline_event_cluster_items"("cluster_id");
CREATE INDEX "headline_event_cluster_items_article_id_idx" ON "headline_event_cluster_items"("article_id");

ALTER TABLE "headline_event_clusters"
ADD CONSTRAINT "headline_event_clusters_analysis_id_fkey"
FOREIGN KEY ("analysis_id") REFERENCES "headline_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "headline_event_cluster_items"
ADD CONSTRAINT "headline_event_cluster_items_cluster_id_fkey"
FOREIGN KEY ("cluster_id") REFERENCES "headline_event_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "headline_event_cluster_items"
ADD CONSTRAINT "headline_event_cluster_items_article_id_fkey"
FOREIGN KEY ("article_id") REFERENCES "headline_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
