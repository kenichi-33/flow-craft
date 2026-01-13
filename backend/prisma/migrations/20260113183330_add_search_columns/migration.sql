-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "full_text" TEXT,
ADD COLUMN     "search_meta" JSONB;

-- CreateIndex
CREATE INDEX "application_full_text_idx" ON "applications" USING GIN ("full_text" gin_trgm_ops);
