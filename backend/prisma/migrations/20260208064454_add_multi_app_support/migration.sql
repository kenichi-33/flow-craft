-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConversationStatus" ADD VALUE 'COLLECTING';
ALTER TYPE "ConversationStatus" ADD VALUE 'CONFIRMING';
ALTER TYPE "ConversationStatus" ADD VALUE 'EXECUTING';

-- AlterTable
ALTER TABLE "conversation_sessions" ADD COLUMN     "allowed_apps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "application_id" TEXT,
ADD COLUMN     "child_application_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "detected_apps" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "slots" JSONB NOT NULL DEFAULT '{}';
