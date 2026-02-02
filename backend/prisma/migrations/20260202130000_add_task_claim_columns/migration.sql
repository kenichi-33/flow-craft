-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "workflow_tasks" ADD COLUMN     "claimed_at" TIMESTAMP(3),
ADD COLUMN     "claimed_by" TEXT;
