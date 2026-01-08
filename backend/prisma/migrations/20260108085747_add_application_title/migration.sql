-- AlterTable
ALTER TABLE "application_definitions" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "title" TEXT NOT NULL DEFAULT '無題';
