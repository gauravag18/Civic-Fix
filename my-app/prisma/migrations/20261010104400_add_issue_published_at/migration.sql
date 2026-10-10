-- Nullable publication time. Existing rows stay NULL; do not backfill.
ALTER TABLE "Issue" ADD COLUMN "publishedAt" TIMESTAMPTZ(3);

-- Published, non-deleted issues sorted newest first.
CREATE INDEX "issue_published_created_at" ON "Issue"("createdAt" DESC) WHERE ("publishedAt" IS NOT NULL AND "deletedAt" IS NULL);

-- Published, non-deleted issues sorted by recent updates.
CREATE INDEX "issue_published_updated_at" ON "Issue"("updatedAt" DESC) WHERE ("publishedAt" IS NOT NULL AND "deletedAt" IS NULL);
