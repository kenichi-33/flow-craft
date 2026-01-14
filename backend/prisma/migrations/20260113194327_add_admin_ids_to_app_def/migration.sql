-- AlterTable
ALTER TABLE "application_definitions" ADD COLUMN     "admin_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
